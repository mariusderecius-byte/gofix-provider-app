import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  SafeAreaView, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { db, getJob, updateJobStatus, updateLocation } from '../services/firebase';
import JobDocSheet from '../components/JobDocSheet';
import { Colors, Radius, Shadows } from '../utils/theme';

const COMMS_STATUSES = ['accepted', 'on_the_way', 'arrived', 'in_progress'];

// Transitions that require before/after documentation
const DOC_GATED = {
  arrived:     'before',  // arrived → in_progress needs beforePhoto + beforeDescription
  in_progress: 'after',   // in_progress → completed needs afterPhoto + afterDescription
};

const STEP_ACTIONS = {
  accepted:   { label: 'I\'m on my way',  next: 'on_the_way' },
  on_the_way: { label: 'I Arrived',       next: 'arrived' },
  arrived:    { label: 'Start job',       next: 'in_progress' },
  in_progress:{ label: 'Mark complete',   next: 'completed' },
};

// Haversine distance in km
function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
    Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function etaMinutes(km) {
  return Math.max(1, Math.round((km / 40) * 60));
}

export default function JobDetailScreen() {
  const navigation          = useNavigation();
  const { jobId }           = useRoute().params || {};
  const { user }            = useAuth();

  const [job,           setJob]           = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [updating,      setUpdating]      = useState(false);
  const [myLocation,    setMyLocation]    = useState(null);
  const [customerPhone, setCustomerPhone] = useState(null);
  const [docSheet,      setDocSheet]      = useState(null); // 'before' | 'after' | null

  const locationWatcher = useRef(null);

  // Fetch customer phone for the Call button
  useEffect(() => {
    if (!job?.userId || customerPhone) return;
    getDoc(doc(db, 'users', job.userId))
      .then(snap => { if (snap.exists()) setCustomerPhone(snap.data().phone || null); })
      .catch(e => console.warn('[JobDetail] customer phone fetch:', e.message));
  }, [job?.userId]);

  const callCustomer = () => {
    if (!customerPhone) {
      Alert.alert('No phone number', 'The customer has not shared a contact number.');
      return;
    }
    const cleaned = customerPhone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() =>
      Alert.alert('Cannot place call', 'Your device cannot open the dialer.'));
  };

  const openChat = () => navigation.navigate('Chat', { jobId });

  // Load job
  useEffect(() => {
    if (!jobId) { setLoading(false); return; }
    getJob(jobId)
      .then(r => setJob(r.data.job))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  // Get GPS permission + initial position
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  // When status becomes on_the_way, share location every 30s
  useEffect(() => {
    if (job?.status === 'on_the_way' && user?.uid) {
      locationWatcher.current = setInterval(async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude } = loc.coords;
          setMyLocation({ latitude, longitude });
          await updateLocation(user.uid, latitude, longitude);
        } catch {}
      }, 30000);
    }
    return () => { if (locationWatcher.current) clearInterval(locationWatcher.current); };
  }, [job?.status]);

  // For ungated transitions (accepted → on_the_way), simple confirm flow.
  // For gated transitions (on_the_way → in_progress, in_progress → completed),
  // open JobDocSheet first; status flip happens after the docs are saved.
  const handleStatusUpdate = async () => {
    const action = STEP_ACTIONS[job.status];
    if (!action) return;

    const docPhase = DOC_GATED[job.status];
    if (docPhase) {
      setDocSheet(docPhase);
      return;
    }

    Alert.alert('Confirm', `"${action.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setUpdating(true);
        try {
          if (action.next === 'on_the_way' && myLocation && user?.uid) {
            await updateLocation(user.uid, myLocation.latitude, myLocation.longitude);
          }
          await updateJobStatus(jobId, action.next);
          setJob(prev => ({ ...prev, status: action.next }));
        } catch (e) {
          Alert.alert('Error', e.response?.data?.error || e.message);
        } finally {
          setUpdating(false);
        }
      }},
    ]);
  };

  // Called once the JobDocSheet has uploaded photo + saved description.
  // Now safe to flip the status.
  const handleDocsSaved = async ({ photoUrl, description }) => {
    const action = STEP_ACTIONS[job.status];
    if (!action) return;
    setUpdating(true);
    try {
      await updateJobStatus(jobId, action.next);
      // Reflect locally — the sheet already wrote the doc fields to Firestore
      setJob(prev => ({
        ...prev,
        status: action.next,
        ...(docSheet === 'before'
          ? { beforePhoto: photoUrl, beforeDescription: description }
          : { afterPhoto:  photoUrl, afterDescription:  description }),
      }));
    } catch (e) {
      Alert.alert('Status update failed', e.response?.data?.error || e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleNavigate = () => {
    if (!job) return;
    const addr = job.address || (job.location ? `${job.location.lat},${job.location.lng}` : '');
    Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(addr)}`);
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );
  if (!job) return (
    <View style={s.center}><Text style={{ color: Colors.gray400 }}>Job not found</Text></View>
  );

  // Customer / job location
  const jobCoord = job.location
    ? { latitude: job.location.lat, longitude: job.location.lng }
    : null;

  const hasMap    = jobCoord && myLocation;
  const km        = hasMap ? distanceKm(myLocation, jobCoord) : null;
  const eta       = km != null ? etaMinutes(km) : null;

  const mapRegion = hasMap ? {
    latitude:      (jobCoord.latitude  + myLocation.latitude)  / 2,
    longitude:     (jobCoord.longitude + myLocation.longitude) / 2,
    latitudeDelta:  Math.abs(jobCoord.latitude  - myLocation.latitude)  * 2.5 + 0.01,
    longitudeDelta: Math.abs(jobCoord.longitude - myLocation.longitude) * 2.5 + 0.01,
  } : jobCoord ? {
    latitude: jobCoord.latitude, longitude: jobCoord.longitude,
    latitudeDelta: 0.02, longitudeDelta: 0.02,
  } : null;

  const nextAction = STEP_ACTIONS[job.status];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{job.category} job</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Map */}
        {mapRegion && (
          <View style={s.mapWrap}>
            <MapView style={s.map} initialRegion={mapRegion} showsUserLocation>
              {/* Customer location pin */}
              {jobCoord && (
                <Marker coordinate={jobCoord} title="Customer location">
                  <View style={s.customerPin}>
                    <Text style={s.customerPinText}>📍</Text>
                  </View>
                </Marker>
              )}
              {/* Route line */}
              {hasMap && (
                <Polyline
                  coordinates={[myLocation, jobCoord]}
                  strokeColor={Colors.primary}
                  strokeWidth={3}
                  lineDashPattern={[8, 5]}
                />
              )}
            </MapView>

            {/* Distance bubble */}
            <View style={s.distBubble}>
              {km != null ? (
                <>
                  <Text style={s.distKm}>{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}</Text>
                  <Text style={s.distLabel}>{eta} min away</Text>
                </>
              ) : (
                <Text style={s.distLabel}>Getting location…</Text>
              )}
            </View>

            {/* Navigate button */}
            <TouchableOpacity style={s.navOverlay} onPress={handleNavigate}>
              <Text style={s.navOverlayText}>🗺 Navigate</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Job info */}
        <View style={s.card}>
          <View style={s.cardTop}>
            <Text style={s.category}>{job.category}</Text>
            <Text style={s.amount}>
              €{job.hourlyRate || '—'}<Text style={s.amountUnit}>/hr</Text>
            </Text>
          </View>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: job.status === 'in_progress' ? Colors.primaryMid : Colors.amber }]} />
            <Text style={s.statusText}>{job.status?.replace(/_/g, ' ')}</Text>
          </View>
          {job.description ? <Text style={s.desc}>{job.description}</Text> : null}
        </View>

        {/* Customer */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Customer</Text>
          <Text style={s.detail}>👤 {job.userName || job.userId || '—'}</Text>
          {job.scheduledFor && <Text style={s.detail}>🕐 {new Date(job.scheduledFor).toLocaleString('en-GB')}</Text>}

          {COMMS_STATUSES.includes(job.status) && (
            <View style={s.commsRow}>
              <TouchableOpacity style={s.commsBtn} onPress={callCustomer}>
                <Text style={s.commsBtnIcon}>📞</Text>
                <Text style={s.commsBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.commsBtn} onPress={openChat}>
                <Text style={s.commsBtnIcon}>💬</Text>
                <Text style={s.commsBtnText}>Chat</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Work documentation (before / after) */}
        {(job.beforePhoto || job.afterPhoto) && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Work documentation</Text>
            {job.beforePhoto && (
              <View style={s.docBlock}>
                <Text style={s.docLabel}>BEFORE</Text>
                <Image source={{ uri: job.beforePhoto }} style={s.docImage} />
                <Text style={s.docDesc}>{job.beforeDescription}</Text>
              </View>
            )}
            {job.afterPhoto && (
              <View style={s.docBlock}>
                <Text style={s.docLabel}>AFTER</Text>
                <Image source={{ uri: job.afterPhoto }} style={s.docImage} />
                <Text style={s.docDesc}>{job.afterDescription}</Text>
              </View>
            )}
          </View>
        )}

        {/* Address */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Location</Text>
          <Text style={s.detail}>📍 {job.address || (jobCoord ? `${jobCoord.latitude.toFixed(4)}, ${jobCoord.longitude.toFixed(4)}` : '—')}</Text>
          {km != null && (
            <Text style={s.distText}>
              {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} from you · ~{eta} min
            </Text>
          )}
          <TouchableOpacity style={s.navBtn} onPress={handleNavigate}>
            <Text style={s.navBtnText}>Open in Maps →</Text>
          </TouchableOpacity>
        </View>

        {/* Action button */}
        {nextAction && (
          <TouchableOpacity style={s.actionBtn} onPress={handleStatusUpdate} disabled={updating}>
            {updating
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.actionBtnText}>{nextAction.label}</Text>}
          </TouchableOpacity>
        )}

        {job.status === 'completed' && (
          <View style={s.completedCard}>
            <Text style={s.completedText}>✓ Job complete! Payment will be released shortly.</Text>
          </View>
        )}

        {/* Live location notice */}
        {job.status === 'on_the_way' && (
          <View style={s.liveCard}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>Your location is being shared with the customer</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <JobDocSheet
        visible={!!docSheet}
        phase={docSheet}
        jobId={jobId}
        onClose={() => setDocSheet(null)}
        onCompleted={handleDocsSaved}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#f5f5f5' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                     padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  back:            { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  headerTitle:     { fontSize: 17, fontWeight: '700', color: Colors.gray900 },
  container:       { padding: 16, gap: 12 },

  // Map
  mapWrap:         { height: 240, borderRadius: Radius.lg, overflow: 'hidden', position: 'relative', ...Shadows.card },
  map:             { ...StyleSheet.absoluteFillObject },
  customerPin:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff',
                     justifyContent: 'center', alignItems: 'center', ...Shadows.card },
  customerPinText: { fontSize: 20 },
  distBubble:      { position: 'absolute', top: 10, left: 10, backgroundColor: '#fff',
                     borderRadius: Radius.md, padding: 10, ...Shadows.card, alignItems: 'center' },
  distKm:          { fontSize: 20, fontWeight: '800', color: Colors.primary },
  distLabel:       { fontSize: 11, color: Colors.gray400 },
  navOverlay:      { position: 'absolute', bottom: 10, right: 10, backgroundColor: Colors.primary,
                     borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  navOverlayText:  { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Cards
  card:            { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadows.card },
  cardTop:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  category:        { fontSize: 16, fontWeight: '700', color: Colors.gray900 },
  amount:          { fontSize: 16, fontWeight: '700', color: Colors.primary },
  amountUnit:      { fontSize: 11, fontWeight: '600', color: Colors.gray500 },
  statusRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },
  statusText:      { fontSize: 13, color: Colors.gray500, textTransform: 'capitalize' },
  desc:            { fontSize: 14, color: Colors.gray600, lineHeight: 22 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: Colors.gray900, marginBottom: 10 },
  detail:          { fontSize: 14, color: Colors.gray600, marginBottom: 6 },
  distText:        { fontSize: 13, color: Colors.primary, fontWeight: '600', marginBottom: 8 },
  navBtn:          { marginTop: 4, backgroundColor: '#f0f7f4', borderRadius: Radius.md,
                     padding: 12, alignItems: 'center' },
  navBtnText:      { color: Colors.primary, fontWeight: '600', fontSize: 14 },

  // Actions
  actionBtn:       { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  actionBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  completedCard:   { backgroundColor: '#e6f4ea', borderRadius: Radius.md, padding: 16 },
  completedText:   { color: '#2d7a3a', fontSize: 14, textAlign: 'center', fontWeight: '600' },
  liveCard:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff',
                     borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.mint },
  liveDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  liveText:        { fontSize: 12, color: Colors.gray600, flex: 1 },

  commsRow:        { flexDirection: 'row', gap: 10, marginTop: 14 },
  commsBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                     gap: 8, paddingVertical: 12, borderRadius: Radius.md,
                     backgroundColor: Colors.primary, ...Shadows.card },
  commsBtnIcon:    { fontSize: 18 },
  commsBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },

  docBlock:        { marginTop: 12 },
  docLabel:        { fontSize: 11, fontWeight: '800', color: Colors.gray400,
                     letterSpacing: 0.8, marginBottom: 6 },
  docImage:        { width: '100%', height: 180, borderRadius: Radius.md, marginBottom: 6 },
  docDesc:         { fontSize: 14, color: Colors.gray700, lineHeight: 20 },
});
