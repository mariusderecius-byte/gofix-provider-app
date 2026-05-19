import { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { db, acceptJob, declineJob } from '../services/firebase';
import { Colors, Radius, Shadows } from '../utils/theme';

const ON_MAP_STATUSES = ['matched', 'accepted', 'on_the_way', 'in_progress'];
const CAT_EMOJI = {
  Plumbing: '🔧', Electrical: '⚡', Cleaning: '🧹',
  Carpentry: '🪚', Moving: '📦', Construction: '🏗️',
};

// Provider has 2 minutes to accept or decline a new offer.
const ACCEPT_WINDOW_MS = 2 * 60 * 1000;

function CountdownPill({ matchedAt, onTimeout }) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    if (!matchedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [matchedAt]);

  if (!matchedAt) return null;
  const startedAt = new Date(matchedAt).getTime();
  const remaining = Math.max(0, ACCEPT_WINDOW_MS - (now - startedAt));

  if (remaining === 0 && !firedRef.current) {
    firedRef.current = true;
    onTimeout?.();
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const danger = remaining < 30000;

  return (
    <View style={[s.countdownPill, danger && s.countdownDanger]}>
      <Text style={[s.countdownText, danger && s.countdownTextDanger]}>
        ⏱  {String(mins).padStart(1,'0')}:{String(secs).padStart(2,'0')} to respond
      </Text>
    </View>
  );
}

const TABS = ['New', 'Upcoming', 'In progress', 'Completed'];
const TAB_FILTER = {
  'New':         j => j.status === 'matched',
  'Upcoming':    j => j.status === 'accepted' || j.status === 'on_the_way',
  'In progress': j => j.status === 'in_progress',
  'Completed':   j => j.status === 'completed',
};

const BADGE = {
  matched:     { bg: '#FEF3C7', text: '#92400E' },
  accepted:    { bg: '#e8f0fe', text: '#1a56db' },
  on_the_way:  { bg: '#FAEEDA', text: '#633806' },
  in_progress: { bg: '#EAF3DE', text: '#27500A' },
  completed:   { bg: '#f0f0f0', text: '#666' },
};

function JobCard({ job, onPress, onAccept, onDecline, accepting, declining }) {
  const status = job.status || 'matched';
  const b = BADGE[status] || BADGE.completed;
  const isNew = status === 'matched';
  const busy  = accepting || declining;
  // Use the same field the user-app shows — hourlyRate on the job doc
  // (snapshotted at create/match time from providers/{id}.hourlyRate)
  const rate  = job.hourlyRate;
  const time = job.scheduledFor
    ? new Date(job.scheduledFor).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'ASAP';

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.cardTop}>
        <Text style={s.category}>{job.category}</Text>
        <Text style={s.amount}>€{rate || '—'}<Text style={s.amountUnit}>/hr</Text></Text>
      </View>
      <View style={s.badgeRow}>
        <View style={[s.badge, { backgroundColor: b.bg }]}>
          <Text style={[s.badgeText, { color: b.text }]}>{status.replace(/_/g, ' ')}</Text>
        </View>
        {status === 'completed' && job.payoutStatus === 'paid' && (
          <View style={s.paidBadge}>
            <Text style={s.paidBadgeText}>✓ Paid</Text>
          </View>
        )}
      </View>
      {job.description ? <Text style={s.desc} numberOfLines={2}>{job.description}</Text> : null}
      {job.location?.lat ? (
        <Text style={s.address}>📍 {job.location.lat.toFixed(4)}, {job.location.lng.toFixed(4)}</Text>
      ) : null}
      <View style={s.cardBottom}>
        <Text style={s.time}>🕐 {time}</Text>
        <Text style={s.user}>👤 {job.userName || '—'}</Text>
      </View>
      {isNew && (
        <>
          <CountdownPill matchedAt={job.matchedAt} onTimeout={onDecline} />
          <View style={s.responseRow}>
            <TouchableOpacity
              style={[s.declineBtn, busy && s.btnDisabled]}
              onPress={onDecline}
              disabled={busy}
            >
              {declining
                ? <ActivityIndicator color="#EF4444" size="small" />
                : <Text style={s.declineBtnText}>Decline</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.acceptBtn, busy && s.btnDisabled]}
              onPress={onAccept}
              disabled={busy}
            >
              {accepting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.acceptBtnText}>Accept</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const navigation = useNavigation();
  const { user }   = useAuth();
  const [activeTab,  setActiveTab]  = useState('New');
  const [allJobs,    setAllJobs]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting,  setAccepting]  = useState(null);
  const [declining,  setDeclining]  = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const mapRef = useRef(null);

  // GPS once on mount (best-effort — map falls back to Baltic region)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {}
    })();
  }, []);

  // Re-center map when GPS resolves
  useEffect(() => {
    if (!myLocation || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: myLocation.latitude, longitude: myLocation.longitude,
      latitudeDelta: 0.08, longitudeDelta: 0.08,
    }, 700);
  }, [myLocation]);

  // Real-time Firestore listener — jobs assigned to this provider appear instantly
  useEffect(() => {
    if (!user?.uid) {
      console.warn('[ProviderJobs] no auth user yet — listener not attached');
      return;
    }
    console.log('[ProviderJobs] attaching listener for providerId ==', user.uid, '(', user.email, ')');
    setLoading(true);
    const q = query(collection(db, 'jobs'), where('providerId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      snap => {
        const jobs = snap.docs.map(d => ({ ...d.data() }));
        jobs.sort((a, b) => ((a.createdAt || '') > (b.createdAt || '') ? -1 : 1));
        console.log(`[ProviderJobs] snapshot → ${jobs.length} job(s) for ${user.uid}`);
        if (jobs.length > 0) {
          console.log('[ProviderJobs] statuses:', jobs.map(j => `${j.category}:${j.status}`).join(', '));
        }
        setAllJobs(jobs);
        setLoading(false);
        setRefreshing(false);
      },
      err => {
        console.error('[ProviderJobs] onSnapshot error:', err);
        setLoading(false);
        setRefreshing(false);
      }
    );
    return () => { console.log('[ProviderJobs] detaching listener'); unsub(); };
  }, [user?.uid]);

  const handleAccept = (jobId) => {
    Alert.alert('Accept job?', 'You will be assigned to this job and the customer will be notified.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: async () => {
        setAccepting(jobId);
        try {
          await acceptJob(jobId);
          setActiveTab('Upcoming');
        } catch (e) {
          Alert.alert('Error', e.response?.data?.error || e.message);
        } finally {
          setAccepting(null);
        }
      }},
    ]);
  };

  // Decline: notify backend, which either reassigns to next match or
  // flips the job to no_providers (depending on flow A vs B).
  const handleDecline = async (jobId) => {
    if (declining) return;
    setDeclining(jobId);
    try {
      await declineJob(jobId);
      // The Firestore listener will drop this job from this provider's view
      // automatically when backend updates providerId.
    } catch (e) {
      console.error('[ProviderJobs] decline failed:', e.response?.data?.error || e.message);
    } finally {
      setDeclining(null);
    }
  };

  const confirmDecline = (jobId) => {
    Alert.alert('Decline job?', 'This job will be offered to the next available provider.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => handleDecline(jobId) },
    ]);
  };

  const filtered = allJobs.filter(TAB_FILTER[activeTab] || (() => false));
  const newCount = allJobs.filter(TAB_FILTER['New']).length;
  // Jobs that should appear as pins on the map (active work, not completed/cancelled)
  const onMap    = allJobs.filter(j =>
    ON_MAP_STATUSES.includes(j.status) && j.location?.lat && j.location?.lng
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My jobs</Text>
        {newCount > 0 && (
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>{newCount} new</Text>
          </View>
        )}
      </View>

      {/* Job map — pins show active customer locations */}
      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: 54.687, longitude: 25.274,
            latitudeDelta: 0.08, longitudeDelta: 0.08,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {onMap.map(j => {
            const isNew = j.status === 'matched';
            return (
              <Marker
                key={j.jobId || j.id}
                coordinate={{ latitude: j.location.lat, longitude: j.location.lng }}
                title={j.category}
                description={isNew ? 'New offer · tap Accept!' : (j.status || '').replace(/_/g, ' ')}
              >
                <View style={[s.pin, isNew && s.pinNew]}>
                  <Text style={s.pinEmoji}>{CAT_EMOJI[j.category] || '🔧'}</Text>
                  {isNew && <View style={s.pinDot} />}
                </View>
              </Marker>
            );
          })}
        </MapView>

        <View style={s.mapBadge}>
          <Text style={s.mapBadgeText}>
            {onMap.length === 0
              ? 'No active jobs on map'
              : `${onMap.length} active job${onMap.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        <TouchableOpacity
          style={s.recenterBtn}
          onPress={() => myLocation && mapRef.current?.animateToRegion({
            latitude: myLocation.latitude, longitude: myLocation.longitude,
            latitudeDelta: 0.08, longitudeDelta: 0.08,
          }, 600)}
        >
          <Text style={s.recenterIcon}>🎯</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {TABS.map(t => {
          const count = allJobs.filter(TAB_FILTER[t]).length;
          return (
            <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)}>
              <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t}</Text>
              {count > 0 && <View style={[s.tabDot, activeTab === t && s.tabDotActive]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>No {activeTab.toLowerCase()} jobs</Text>
          <Text style={s.emptySub}>New jobs will appear here instantly when matched</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={j => j.jobId || j.id || String(Math.random())}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const id = item.jobId || item.id;
            return (
              <JobCard
                job={item}
                onPress={() => navigation.navigate('JobDetail', { jobId: id })}
                onAccept={() => handleAccept(id)}
                onDecline={() => confirmDecline(id)}
                accepting={accepting === id}
                declining={declining === id}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#f5f5f5' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20,
                   backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  headerTitle:   { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  headerBadge:   { backgroundColor: '#EF4444', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  headerBadgeText:{ fontSize: 12, color: '#fff', fontWeight: '700' },

  // Job map
  mapWrap:       { height: 220, position: 'relative' },
  pin:           { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff',
                   justifyContent: 'center', alignItems: 'center',
                   borderWidth: 2.5, borderColor: Colors.primary, ...Shadows.card },
  pinNew:        { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  pinEmoji:      { fontSize: 18 },
  pinDot:        { position: 'absolute', top: -3, right: -3, width: 10, height: 10,
                   borderRadius: 5, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff' },
  mapBadge:      { position: 'absolute', top: 10, left: 10,
                   backgroundColor: 'rgba(255,255,255,0.95)',
                   paddingHorizontal: 12, paddingVertical: 6,
                   borderRadius: 99, ...Shadows.card },
  mapBadgeText:  { fontSize: 12, fontWeight: '700', color: Colors.gray700 },
  recenterBtn:   { position: 'absolute', top: 10, right: 10,
                   width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff',
                   justifyContent: 'center', alignItems: 'center', ...Shadows.card },
  recenterIcon:  { fontSize: 18 },
  tabs:          { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16,
                   borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  tab:           { paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2,
                   borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabActive:     { borderBottomColor: Colors.primary },
  tabText:       { fontSize: 13, color: Colors.gray500, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  tabDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.gray400 },
  tabDotActive:  { backgroundColor: Colors.primary },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  list:          { padding: 16, gap: 12 },
  card:          { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16 },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  badge:         { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  badgeText:     { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  category:      { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  amount:        { fontSize: 15, fontWeight: '700', color: Colors.primary },
  amountUnit:    { fontSize: 11, fontWeight: '600', color: Colors.gray500 },
  badgeRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paidBadge:     { backgroundColor: '#E6F4EA', alignSelf: 'flex-start',
                   paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  paidBadgeText: { fontSize: 10, fontWeight: '800', color: '#1F6B36' },
  desc:          { fontSize: 14, color: Colors.gray600, marginBottom: 8, lineHeight: 20 },
  address:       { fontSize: 13, color: Colors.gray500, marginBottom: 8 },
  cardBottom:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  time:          { fontSize: 13, color: Colors.gray500 },
  user:          { fontSize: 13, color: Colors.gray500 },
  countdownPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
                   paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
                   backgroundColor: '#FEF3C7', marginTop: 6, marginBottom: 4 },
  countdownDanger:{ backgroundColor: '#FEE2E2' },
  countdownText: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  countdownTextDanger: { color: '#991B1B' },

  responseRow:   { flexDirection: 'row', gap: 10, marginTop: 8 },
  declineBtn:    { flex: 1, paddingVertical: 12, borderRadius: Radius.md,
                   alignItems: 'center', backgroundColor: '#fff',
                   borderWidth: 1.5, borderColor: '#EF4444' },
  declineBtnText:{ color: '#EF4444', fontSize: 14, fontWeight: '700' },
  acceptBtn:     { flex: 1, paddingVertical: 12, borderRadius: Radius.md,
                   alignItems: 'center', backgroundColor: '#00C853' },
  acceptBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btnDisabled:   { opacity: 0.5 },
  emptyTitle:    { fontSize: 18, fontWeight: '700', color: Colors.gray900, marginBottom: 8 },
  emptySub:      { fontSize: 14, color: Colors.gray500, textAlign: 'center', paddingHorizontal: 40 },
});
