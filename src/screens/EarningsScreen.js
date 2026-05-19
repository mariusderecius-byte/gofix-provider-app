import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, Animated,
} from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../services/firebase';
import { Colors, Radius, Shadows } from '../utils/theme';

// Same formula the admin /admin/payouts route uses to compute earnings.
// Falls back to estimatedHours × hourlyRate × 0.85 if the explicit fields
// were never written (legacy jobs from before the completeJob fix).
function jobNet(j) {
  const gross = parseFloat(j.totalAmount || (j.estimatedHours || 2) * (j.hourlyRate || 18)) || 0;
  return parseFloat(j.providerPayout || gross * 0.85) || 0;
}
function jobGross(j) {
  return parseFloat(j.totalAmount || (j.estimatedHours || 2) * (j.hourlyRate || 18)) || 0;
}
const isPaid = (j) => j.payoutStatus === 'paid';

// Treat as "earnings job" if either: status is completed, OR providerPayout
// exists (handles edge cases where status was overwritten but payout remains).
const isEarningsJob = (j) =>
  j.status === 'completed' || (j.providerPayout != null && j.providerPayout > 0);

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())
    return `Today ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EarningsScreen() {
  const { user } = useAuth();
  const [allJobs,  setAllJobs]  = useState([]);
  const [payouts,  setPayouts]  = useState([]);
  const [banner,   setBanner]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const seenPayoutIds = useRef(null);
  const bannerAnim    = useRef(new Animated.Value(0)).current;

  // ── Jobs listener — identical query semantics to admin /admin/payouts ───────
  useEffect(() => {
    if (!user?.uid) {
      console.warn('[Earnings] no auth user yet — waiting');
      return;
    }
    const uid = user.uid;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Current UID:', uid);
    console.log('Email:      ', auth.currentUser?.email);
    console.log('Attaching jobs listener: where providerId ==', uid);

    const q = query(collection(db, 'jobs'), where('providerId', '==', uid));

    const unsub = onSnapshot(q,
      snap => {
        const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const earn = all.filter(isEarningsJob);

        console.log('Jobs found:', all.length);
        console.log('Earnings-eligible jobs (status=completed OR providerPayout>0):', earn.length);
        if (earn.length > 0) {
          console.log('  paid:', earn.filter(isPaid).length,
                      '· pending:', earn.filter(j => !isPaid(j)).length);
          console.log('  first row:', JSON.stringify({
            jobId:          earn[0].jobId,
            providerId:     earn[0].providerId,
            status:         earn[0].status,
            payoutStatus:   earn[0].payoutStatus || '(missing)',
            totalAmount:    earn[0].totalAmount,
            providerPayout: earn[0].providerPayout,
          }));
        }

        earn.sort((a, b) => (a.completedAt > b.completedAt ? -1 : 1));
        setAllJobs(earn);
        setLoading(false);
        setError(null);
      },
      err => {
        console.error('[Earnings] listener ERROR:', err.code, err.message);
        setError(`${err.code}: ${err.message}`);
        setLoading(false);
      }
    );
    return () => { console.log('[Earnings] detach listener'); unsub(); };
  }, [user?.uid]);

  // ── Payouts listener — drives banner + history ──────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'payouts'), where('providerId', '==', user.uid));
    const unsub = onSnapshot(q,
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.paidAt > b.paidAt ? -1 : 1));

        if (seenPayoutIds.current === null) {
          seenPayoutIds.current = new Set(list.map(p => p.id));
          setPayouts(list);
          return;
        }
        const fresh = list.find(p => !seenPayoutIds.current.has(p.id));
        if (fresh) {
          seenPayoutIds.current.add(fresh.id);
          setBanner({ amount: fresh.amount });
          Animated.sequence([
            Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true, friction: 7 }),
            Animated.delay(4500),
            Animated.timing(bannerAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
          ]).start(() => setBanner(null));
        }
        setPayouts(list);
      },
      err => console.warn('[Earnings] payouts listener:', err.message),
    );
    return unsub;
  }, [user?.uid]);

  // ── Aggregates ──────────────────────────────────────────────────────────────
  const paidJobs    = allJobs.filter(isPaid);
  const pendingJobs = allJobs.filter(j => !isPaid(j));
  const nextPayout  = pendingJobs.reduce((s, j) => s + jobNet(j), 0);
  const totalEarned = paidJobs.reduce((s, j) => s + jobNet(j), 0);
  const allTimeGross = allJobs.reduce((s, j) => s + jobGross(j), 0);

  console.log('[Earnings] render · jobs:', allJobs.length,
              '· nextPayout: €' + nextPayout.toFixed(2),
              '· totalEarned: €' + totalEarned.toFixed(2));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.headerTitle}>Earnings</Text></View>

      {/* Slide-in banner on new admin payout */}
      {banner && (
        <Animated.View
          pointerEvents="none"
          style={[s.banner, {
            opacity: bannerAnim,
            transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0,1], outputRange: [-30,0] }) }],
          }]}
        >
          <Text style={s.bannerEmoji}>💰</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>Payment of €{banner.amount?.toFixed(2)} approved by admin!</Text>
            <Text style={s.bannerSub}>The funds have been released to your account</Text>
          </View>
        </Animated.View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.container}>

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorLabel}>Listener error</Text>
              <Text style={s.errorText}>{error}</Text>
              <Text style={s.errorHint}>
                If this says "permission-denied", run{'\n'}
                <Text style={{ fontFamily: 'monospace' }}>firebase deploy --only firestore:rules</Text>{'\n'}
                from the backend folder.
              </Text>
            </View>
          )}

          {/* TWO CARDS — Next payout (pending) and Total earned (all-time paid) */}
          <View style={s.cardsRow}>
            <View style={[s.bigCard, s.cardPending]}>
              <Text style={s.bigCardLabel}>⏳ Next payout</Text>
              <Text style={[s.bigCardValue, { color: '#92400E' }]}>€{nextPayout.toFixed(2)}</Text>
              <Text style={s.bigCardSub}>
                {pendingJobs.length} unpaid job{pendingJobs.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={[s.bigCard, s.cardPaid]}>
              <Text style={s.bigCardLabel}>✅ Total earned</Text>
              <Text style={[s.bigCardValue, { color: '#1F6B36' }]}>€{totalEarned.toFixed(2)}</Text>
              <Text style={s.bigCardSub}>
                {paidJobs.length} paid job{paidJobs.length !== 1 ? 's' : ''} · all time
              </Text>
            </View>
          </View>

          {/* Gross summary */}
          {allJobs.length > 0 && (
            <View style={s.grossBox}>
              <Text style={s.grossText}>
                Gross €{allTimeGross.toFixed(2)} · 15% fee · You receive €{(allTimeGross * 0.85).toFixed(2)}
              </Text>
            </View>
          )}

          {/* Payout history */}
          {payouts.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Payout history</Text>
              {payouts.slice(0, 10).map(p => (
                <View key={p.id} style={s.payoutHistCard}>
                  <View style={s.payoutHistTop}>
                    <View>
                      <Text style={s.payoutHistTitle}>Payment received</Text>
                      <Text style={s.payoutHistSub}>{fmtDate(p.paidAt)} · {p.jobCount} job{p.jobCount !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={s.payoutHistAmount}>+€{(p.amount || 0).toFixed(2)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Transactions — every earnings-eligible job as a row */}
          <Text style={s.sectionTitle}>Transactions</Text>

          {allJobs.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>💰</Text>
              <Text style={s.emptyTitle}>No earnings yet</Text>
              <Text style={s.emptySub}>Completed jobs will appear here once customers book you</Text>
            </View>
          ) : (
            allJobs.map(j => {
              const net   = jobNet(j);
              const gross = jobGross(j);
              const fee   = gross - net;
              const paid  = isPaid(j);
              return (
                <View key={j.jobId || j.id} style={s.txCard}>
                  <View style={s.txTop}>
                    <Text style={s.txCategory}>{j.category || 'Service'}</Text>
                    <Text style={[s.txNet, { color: paid ? '#1F6B36' : '#92400E' }]}>
                      +€{net.toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.txMeta}>
                    <Text style={s.txDate}>{fmtDate(j.completedAt || j.createdAt)}</Text>
                    <View style={[s.statusPill, paid ? s.statusPillPaid : s.statusPillPending]}>
                      <Text style={[s.statusPillText, { color: paid ? '#1F6B36' : '#92400E' }]}>
                        {paid ? '✓ Paid' : '⏳ Pending'}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.txMath}>
                    €{gross.toFixed(2)} − 15% fee (€{fee.toFixed(2)}) = €{net.toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f5f5f5' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  headerTitle:  { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  container:    { padding: 16, paddingBottom: 40 },

  // Banner
  banner:       { position: 'absolute', top: 70, left: 16, right: 16, zIndex: 1000,
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: '#00C853', borderRadius: Radius.lg,
                  paddingVertical: 14, paddingHorizontal: 16, ...Shadows.modal },
  bannerEmoji:  { fontSize: 28 },
  bannerTitle:  { fontSize: 15, fontWeight: '800', color: '#fff' },
  bannerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 },

  // Two stat cards
  cardsRow:     { flexDirection: 'row', gap: 12, marginBottom: 14 },
  bigCard:      { flex: 1, padding: 18, borderRadius: Radius.lg, ...Shadows.card,
                  borderWidth: 1, borderColor: 'transparent' },
  cardPending:  { backgroundColor: '#FFF8E6' },
  cardPaid:     { backgroundColor: '#E1F5EE' },
  bigCardLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray500,
                  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  bigCardValue: { fontSize: 26, fontWeight: '800' },
  bigCardSub:   { fontSize: 11, color: Colors.gray500, marginTop: 6 },

  grossBox:     { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, marginBottom: 22,
                  ...Shadows.card },
  grossText:    { fontSize: 12, color: Colors.gray600, textAlign: 'center', lineHeight: 18 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900,
                  marginTop: 8, marginBottom: 12 },

  // Payout history
  payoutHistCard: { backgroundColor: '#fff', borderRadius: Radius.md, padding: 14,
                    marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#00C853', ...Shadows.card },
  payoutHistTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payoutHistTitle:{ fontSize: 14, fontWeight: '700', color: Colors.gray900 },
  payoutHistSub:  { fontSize: 12, color: Colors.gray500, marginTop: 3 },
  payoutHistAmount:{ fontSize: 18, fontWeight: '800', color: '#00C853' },

  // Transaction row
  txCard:       { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16,
                  marginBottom: 10, ...Shadows.card },
  txTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  txCategory:   { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  txNet:        { fontSize: 17, fontWeight: '800' },
  txMeta:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  txDate:       { fontSize: 12, color: Colors.gray500 },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  statusPillPaid:    { backgroundColor: '#E1F5EE' },
  statusPillPending: { backgroundColor: '#FFF8E6' },
  statusPillText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  txMath:       { fontSize: 11, color: Colors.gray400 },

  // Empty
  empty:        { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 32,
                  alignItems: 'center', ...Shadows.card },
  emptyIcon:    { fontSize: 44, marginBottom: 12 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: Colors.gray900, marginBottom: 6 },
  emptySub:     { fontSize: 13, color: Colors.gray500, textAlign: 'center', lineHeight: 18 },

  // (unused diagnostic styles intentionally removed)
  diag:         { backgroundColor: '#F8FAFB', borderRadius: Radius.md, padding: 12,
                  marginBottom: 12, borderWidth: 1, borderColor: Colors.gray200 },
  diagLabel:    { fontSize: 10, fontWeight: '800', color: Colors.gray500,
                  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  diagLine:     { fontSize: 11, color: Colors.gray700, marginBottom: 2, lineHeight: 16 },
  diagMono:     { fontFamily: 'monospace', color: Colors.gray900, fontWeight: '600' },

  // Listener error
  errorBox:     { backgroundColor: '#FEE2E2', borderRadius: Radius.md, padding: 12,
                  borderWidth: 1, borderColor: '#FECACA', marginBottom: 12 },
  errorLabel:   { fontSize: 11, fontWeight: '800', color: '#991B1B',
                  textTransform: 'uppercase', marginBottom: 4 },
  errorText:    { fontSize: 12, color: '#7F1D1D', fontFamily: 'monospace', marginBottom: 6 },
  errorHint:    { fontSize: 11, color: '#7F1D1D', lineHeight: 16 },
});
