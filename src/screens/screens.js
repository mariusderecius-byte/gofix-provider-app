import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch,
  Alert, SafeAreaView, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  listJobs, updateJobStatus, acceptJob, getMyProfile,
  updateAvailability, getEarnings, updateProfile,
} from '../services/firebase';

const T = '#0F6E56';
const TL = '#E1F5EE';
const TM = '#1D9E75';
const MINT = '#9FE1CB';
const G9 = '#111827';
const G6 = '#4B5563';
const G4 = '#9CA3AF';
const G2 = '#E5E7EB';
const G1 = '#F9FAFB';
const R  = 12;

// ── Shared ────────────────────────────────────────────────────────────────────
function Header({ title, sub }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: G2 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: G9 }}>{title}</Text>
      {sub && <Text style={{ fontSize: 12, color: G4, marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[{ backgroundColor: '#fff', borderRadius: R, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }, style]}>{children}</View>;
}

function StatCard({ label, value, sub, color }) {
  return (
    <View style={{ flex: 1, backgroundColor: G1, borderRadius: R, padding: 14 }}>
      <Text style={{ fontSize: 11, color: G4, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 24, fontWeight: '700', color: color || G9 }}>{value}</Text>
      {sub && <Text style={{ fontSize: 11, color: TM, marginTop: 2 }}>{sub}</Text>}
    </View>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
export function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigation = useNavigation();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try { await login(email, password); }
    catch (e) { Alert.alert('Login failed', e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T }}>
      <View style={{ flex: 1, padding: 28, justifyContent: 'center' }}>
        <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', marginBottom: 6 }}>GoFix</Text>
        <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 40 }}>Provider portal</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 14 }}>
          <TextInput style={{ borderWidth: 1, borderColor: G2, borderRadius: 10, padding: 14, fontSize: 15 }} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={{ borderWidth: 1, borderColor: G2, borderRadius: 10, padding: 14, fontSize: 15 }} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={{ backgroundColor: T, borderRadius: 10, padding: 16, alignItems: 'center' }} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sign in</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={{ alignItems: 'center' }}>
            <Text style={{ color: T, fontSize: 14 }}>New provider? Register →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Signup Screen ─────────────────────────────────────────────────────────────
export function SignupScreen() {
  const [name,  setName]     = useState('');
  const [email, setEmail]    = useState('');
  const [phone, setPhone]    = useState('');
  const [pass,  setPass]     = useState('');
  const [cats,  setCats]     = useState([]);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigation  = useNavigation();
  const ALL_CATS = ['plumbing','electrical','cleaning','gardening','painting','handyman'];
  const toggleCat = c => setCats(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);

  const handleSignup = async () => {
    if (!name || !email || !pass || !phone || !cats.length) return Alert.alert('Fill all fields and select at least one category');
    setLoading(true);
    try { await signup(email, pass, name, phone, cats); }
    catch (e) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 20 }}><Text style={{ color: T }}>← Back</Text></TouchableOpacity>
        <Text style={{ fontSize: 26, fontWeight: '700', color: G9, marginBottom: 4 }}>Join as a provider</Text>
        <Text style={{ fontSize: 14, color: G4, marginBottom: 24 }}>Start earning with GoFix</Text>
        {[['Full name', name, setName, 'default', false], ['Email', email, setEmail, 'email-address', false], ['Phone', phone, setPhone, 'phone-pad', false], ['Password', pass, setPass, 'default', true]].map(([lbl, val, setter, kb, sec]) => (
          <View key={lbl} style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: G6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{lbl}</Text>
            <TextInput style={{ borderWidth: 1, borderColor: G2, borderRadius: 10, padding: 13, fontSize: 15, backgroundColor: G1 }} value={val} onChangeText={setter} keyboardType={kb} secureTextEntry={sec} />
          </View>
        ))}
        <Text style={{ fontSize: 11, fontWeight: '700', color: G6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Services offered</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {ALL_CATS.map(c => (
            <TouchableOpacity key={c} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: cats.includes(c) ? T : G2, backgroundColor: cats.includes(c) ? TL : '#fff' }} onPress={() => toggleCat(c)}>
              <Text style={{ fontSize: 13, color: cats.includes(c) ? T : G6, fontWeight: '500', textTransform: 'capitalize' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={{ backgroundColor: T, borderRadius: 10, padding: 16, alignItems: 'center' }} onPress={handleSignup} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Create account</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Jobs Screen ───────────────────────────────────────────────────────────────
export function JobsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [jobs, setJobs]         = useState([]);
  const [tab, setTab]           = useState('new');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await listJobs({ limit: 30 });
      setJobs(res.data.jobs || []);
    } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = {
    new:      jobs.filter(j => j.status === 'matched'),
    active:   jobs.filter(j => ['accepted','on_the_way','in_progress'].includes(j.status)),
    done:     jobs.filter(j => ['completed','cancelled'].includes(j.status)),
  }[tab] || [];

  const handleAccept = async (jobId) => {
    try {
      await acceptJob(jobId);
      await load();
      Alert.alert('Job accepted!', 'Head to the location and update your status as you go.');
    } catch (e) { Alert.alert('Error', e.response?.data?.error || e.message); }
  };

  const STATUS_COLORS = { matched: { bg: '#DBEAFE', text: '#1E40AF' }, accepted: { bg: TL, text: '#085041' }, on_the_way: { bg: '#FEF3C7', text: '#92400E' }, in_progress: { bg: '#EDE9FE', text: '#5B21B6' }, completed: { bg: '#D1FAE5', text: '#065F46' }, cancelled: { bg: '#FEE2E2', text: '#991B1B' } };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: G1 }}>
      <Header title="Job queue" sub={`${filtered.length} ${tab} jobs`} />
      <View style={{ flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff' }}>
        {['new', 'active', 'done'].map(t => (
          <TouchableOpacity key={t} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: tab === t ? T : G1, borderWidth: 1, borderColor: tab === t ? T : G2 }} onPress={() => setTab(t)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tab === t ? '#fff' : G4, textTransform: 'capitalize' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T} />}>
        {filtered.length === 0 && <Text style={{ textAlign: 'center', color: G4, marginTop: 60, fontSize: 15 }}>No {tab} jobs right now</Text>}
        {filtered.map(j => {
          const sc = STATUS_COLORS[j.status] || { bg: G1, text: G6 };
          return (
            <TouchableOpacity key={j.jobId} style={{ backgroundColor: '#fff', borderRadius: R, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 }}
              onPress={() => navigation.navigate('JobDetail', { job: j, onStatusChange: load })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: G9, textTransform: 'capitalize' }}>{j.category}</Text>
                  <Text style={{ fontSize: 12, color: G4, marginTop: 2 }}>{j.description?.slice(0, 60) || 'No description'}…</Text>
                </View>
                <View style={{ backgroundColor: sc.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: sc.text, textTransform: 'capitalize' }}>{j.status.replace('_', ' ')}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: G6 }}>~{j.estimatedHours}h · €{j.hourlyRate}/hr</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T }}>≈€{((j.estimatedHours || 2) * (j.hourlyRate || 18) * 0.85).toFixed(0)}</Text>
              </View>
              {j.status === 'matched' && (
                <TouchableOpacity style={{ backgroundColor: T, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 }} onPress={() => handleAccept(j.jobId)}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Accept job →</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Job Detail Screen ─────────────────────────────────────────────────────────
export function JobDetailScreen() {
  const navigation = useNavigation();
  const { job, onStatusChange } = useRoute().params;
  const [status, setStatus] = useState(job.status);
  const [updating, setUpdating] = useState(false);

  const NEXT = { accepted: 'on_the_way', on_the_way: 'in_progress', in_progress: 'completed' };
  const NEXT_LABEL = { accepted: 'I\'m on the way', on_the_way: 'I\'ve arrived — start job', in_progress: 'Mark as complete' };

  const handleNext = async () => {
    const nextStatus = NEXT[status];
    if (!nextStatus) return;
    setUpdating(true);
    try {
      await updateJobStatus(job.jobId, nextStatus);
      setStatus(nextStatus);
      onStatusChange?.();
      if (nextStatus === 'completed') {
        Alert.alert('Job marked complete', 'Payment will be released after user confirms.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setUpdating(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: G2 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={{ color: T, fontSize: 15 }}>← Back</Text></TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: G9 }}>Job details</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Text style={{ fontSize: 20, fontWeight: '700', color: G9, textTransform: 'capitalize', marginBottom: 4 }}>{job.category}</Text>
          <Text style={{ fontSize: 14, color: G6, lineHeight: 22 }}>{job.description || 'No description provided.'}</Text>
        </Card>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard label="Rate"     value={`€${job.hourlyRate}/hr`} color={T} />
          <StatCard label="Est. hours" value={`~${job.estimatedHours}h`} />
          <StatCard label="Your cut" value={`€${((job.estimatedHours || 2) * (job.hourlyRate || 18) * 0.85).toFixed(0)}`} color={T} />
        </View>
        <Card>
          <Text style={{ fontSize: 12, fontWeight: '700', color: G4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Location</Text>
          <Text style={{ fontSize: 14, color: G6 }}>
            {job.location ? `${job.location.lat?.toFixed(4)}, ${job.location.lng?.toFixed(4)}` : 'Location not available'}
          </Text>
        </Card>
        <Card>
          <Text style={{ fontSize: 12, fontWeight: '700', color: G4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Status</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: T, textTransform: 'capitalize' }}>{status.replace('_', ' ')}</Text>
        </Card>
        {NEXT[status] && (
          <TouchableOpacity style={{ backgroundColor: T, borderRadius: R, padding: 16, alignItems: 'center', marginTop: 8 }} onPress={handleNext} disabled={updating}>
            {updating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{NEXT_LABEL[status]}</Text>}
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Earnings Screen ───────────────────────────────────────────────────────────
export function EarningsScreen() {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      getEarnings(user.uid).then(r => setEarnings(r.data)).catch(() => {}).finally(() => setLoading(false));
    }
  }, [user]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: G1 }}>
      <Header title="Earnings" sub="Your income dashboard" />
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {loading ? <ActivityIndicator color={T} style={{ marginTop: 40 }} /> : (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <StatCard label="Total earned" value={`€${(earnings?.totalEarnings || 0).toFixed(2)}`} color={T} />
              <StatCard label="Jobs done"   value={earnings?.totalJobs || 0} />
            </View>
            <Card style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: G4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Recent payouts</Text>
              {(earnings?.jobs || []).slice(0, 8).map((j, i) => (
                <View key={j.jobId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i < 7 ? 0.5 : 0, borderBottomColor: G2 }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: G9, textTransform: 'capitalize' }}>{j.category}</Text>
                    <Text style={{ fontSize: 11, color: G4 }}>{j.completedAt ? new Date(j.completedAt).toLocaleDateString() : '—'}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: T }}>€{(j.providerPayout || 0).toFixed(2)}</Text>
                </View>
              ))}
              {(earnings?.jobs || []).length === 0 && <Text style={{ color: G4, textAlign: 'center', paddingVertical: 20 }}>No completed jobs yet</Text>}
            </Card>
            <Card>
              <Text style={{ fontSize: 12, fontWeight: '700', color: G4, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Platform fee info</Text>
              <Text style={{ fontSize: 13, color: G6, lineHeight: 20 }}>GoFix takes a 15% commission on each job. Your payout is transferred weekly via Stripe Connect every Monday.</Text>
            </Card>
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Availability Screen ───────────────────────────────────────────────────────
export function AvailabilityScreen() {
  const { user } = useAuth();
  const [avail, setAvail] = useState({ now: false, weekdays: true, weekends: false, evenings: false, emergency: false });
  const [radius, setRadius] = useState(10);
  const [rate, setRate]   = useState(18);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      getMyProfile(user.uid).then(r => {
        setAvail(r.data.provider?.availability || avail);
        setRadius(r.data.provider?.serviceRadiusKm || 10);
        setRate(r.data.provider?.hourlyRate || 18);
      }).catch(() => {});
    }
  }, [user]);

  const toggle = key => setAvail(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await updateAvailability(user.uid, avail);
      await updateProfile(user.uid, { serviceRadiusKm: radius, hourlyRate: rate });
      Alert.alert('Saved!', 'Your availability has been updated.');
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const ITEMS = [
    ['now',       'Available now',  'Accept jobs immediately'],
    ['weekdays',  'Mon – Fri',      'Available on weekdays'],
    ['weekends',  'Weekends',       'Saturday and Sunday'],
    ['evenings',  'Evenings',       'After 6 PM'],
    ['emergency', 'Emergency calls','Urgent same-hour requests'],
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: G1 }}>
      <Header title="Availability" sub="Control when you receive jobs" />
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        <Card style={{ marginBottom: 10 }}>
          {ITEMS.map(([key, label, sub], i) => (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < ITEMS.length - 1 ? 0.5 : 0, borderBottomColor: G2 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: G9, fontWeight: '500' }}>{label}</Text>
                <Text style={{ fontSize: 12, color: G4, marginTop: 1 }}>{sub}</Text>
              </View>
              <Switch value={avail[key]} onValueChange={() => toggle(key)} trackColor={{ true: T }} thumbColor="#fff" />
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: G9, marginBottom: 8 }}>Hourly rate: €{rate}/hr</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[15, 18, 22, 28, 35].map(r => (
              <TouchableOpacity key={r} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: rate === r ? T : G1, borderWidth: 1, borderColor: rate === r ? T : G2 }} onPress={() => setRate(r)}>
                <Text style={{ fontSize: 13, color: rate === r ? '#fff' : G6, fontWeight: '600' }}>€{r}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ fontSize: 11, color: G4, marginTop: 8 }}>Platform avg: €17/hr · Top earners: €28/hr</Text>
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: G9, marginBottom: 8 }}>Service radius: {radius} km</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[5, 10, 15, 20, 30].map(r => (
              <TouchableOpacity key={r} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: radius === r ? T : G1, borderWidth: 1, borderColor: radius === r ? T : G2 }} onPress={() => setRadius(r)}>
                <Text style={{ fontSize: 12, color: radius === r ? '#fff' : G6, fontWeight: '600' }}>{r}km</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <TouchableOpacity style={{ backgroundColor: T, borderRadius: R, padding: 16, alignItems: 'center' }} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save changes</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Profile Screen ────────────────────────────────────────────────────────────
export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (user?.uid) getMyProfile(user.uid).then(r => setProfile(r.data.provider)).catch(() => {});
  }, [user]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: G1 }}>
      <ScrollView>
        <View style={{ backgroundColor: T, paddingVertical: 36, alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#fff' }}>{profile?.name?.[0] || 'P'}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>{profile?.name || 'Provider'}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{profile?.categories?.join(', ') || ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {[`⭐ ${profile?.rating || '0.0'}`, `${profile?.reviewCount || 0} reviews`, profile?.status === 'verified' ? '✓ Verified' : profile?.status || 'Pending'].map(b => (
              <View key={b} style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
                <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ margin: 16 }}>
          {[['KYC & Verification', '→'], ['Bank account (Stripe)', '→'], ['Portfolio photos', '→'], ['Skills & certificates', '→'], ['Help & support', '→']].map(([label, icon]) => (
            <TouchableOpacity key={label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 8 }}>
              <Text style={{ flex: 1, fontSize: 15, color: G9 }}>{label}</Text>
              <Text style={{ color: G4 }}>{icon}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={{ backgroundColor: '#FEE2E2', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 }} onPress={() => Alert.alert('Sign out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: logout }])}>
            <Text style={{ color: '#991B1B', fontWeight: '700', fontSize: 15 }}>Sign out</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: 'center', fontSize: 12, color: G4, marginBottom: 32 }}>GoFix Provider v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default JobsScreen;
