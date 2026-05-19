import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, SafeAreaView, ActivityIndicator, Linking,
} from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, updateProfile, startStripeOnboard } from '../services/firebase';
import { Colors, Radius, Shadows } from '../utils/theme';

const CAT_EMOJI = {
  Plumbing: '🔧', Electrical: '⚡', Cleaning: '🧹',
  Painting: '🎨', Carpentry: '🪚', Moving: '📦',
};

function InfoRow({ label, value, mono }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.infoMono]} selectable>{value || '—'}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout: signOut } = useAuth();

  const [profile,    setProfile]    = useState(null);
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  // Kick off Stripe Connect onboarding: backend creates (or reuses) the
  // Connect account, returns a hosted-onboarding URL, we open it in the
  // device browser. When provider returns, Firestore listener picks up the
  // newly-set stripeAccountId.
  const handleConnectStripe = async () => {
    if (!user?.uid) return;
    setOnboarding(true);
    try {
      const res = await startStripeOnboard(user.uid);
      const url = res.data?.url;
      if (!url) throw new Error('No onboarding URL returned');
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('Cannot open Stripe onboarding URL');
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(
        'Could not start onboarding',
        e.response?.data?.error || e.message || 'Please try again in a moment.',
      );
    } finally {
      setOnboarding(false);
    }
  };

  // Load real provider profile from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'providers', user.uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setName(data.name || '');
        setPhone(data.phone || '');
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user?.uid]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    setSaving(true);
    try {
      await updateProfile(user.uid, { name: name.trim(), phone: phone.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const initials = (name || profile?.name || user?.email || '?')[0].toUpperCase();
  const categories = profile?.categories || [];

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>My profile</Text>
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Avatar + verified badge */}
        <View style={s.avatarWrap}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.avatarName}>{profile?.name || '—'}</Text>
          <Text style={s.avatarEmail}>{user?.email}</Text>
          <View style={s.verifiedBadge}>
            <Text style={s.verifiedText}>✓ Verified provider</Text>
          </View>
        </View>

        {/* Stripe Connect — payouts setup */}
        {profile?.stripeAccountId ? (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Payouts</Text>
            <View style={s.payoutConnectedRow}>
              <View style={s.payoutCheckCircle}>
                <Text style={s.payoutCheck}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.payoutConnectedTitle}>Stripe account connected</Text>
                <Text style={s.payoutConnectedSub}>
                  Payouts go to your bank account when jobs complete.
                </Text>
                <Text style={s.payoutAcct} selectable>{profile.stripeAccountId}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.payoutSecondaryBtn}
              onPress={handleConnectStripe}
              disabled={onboarding}
            >
              {onboarding
                ? <ActivityIndicator color={Colors.primary} />
                : <Text style={s.payoutSecondaryText}>Update bank details</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.card, s.payoutSetupCard]}>
            <Text style={s.payoutSetupBadge}>SETUP REQUIRED</Text>
            <Text style={s.payoutSetupTitle}>Connect a payout account</Text>
            <Text style={s.payoutSetupBody}>
              To receive payment for completed jobs, link your bank via Stripe.
              The platform fee is 15% — you keep 85% of every job.
            </Text>
            <TouchableOpacity
              style={[s.payoutPrimaryBtn, onboarding && s.payoutPrimaryBtnDisabled]}
              onPress={handleConnectStripe}
              disabled={onboarding}
            >
              {onboarding
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.payoutPrimaryText}>Connect with Stripe →</Text>}
            </TouchableOpacity>
            <Text style={s.payoutSetupFootnote}>
              You'll be taken to Stripe's secure onboarding to add your bank
              and verify your identity. It takes about 5 minutes.
            </Text>
          </View>
        )}

        {/* Edit personal info */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Personal info</Text>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Full name</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={Colors.gray400}
              autoCapitalize="words"
            />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputReadOnly}>
              <Text style={s.inputReadOnlyText}>{user?.email || '—'}</Text>
            </View>
          </View>
          <View style={[s.fieldWrap, { marginBottom: 0 }]}>
            <Text style={s.label}>Phone number</Text>
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+370 600 00000"
              placeholderTextColor={Colors.gray400}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Account info (read-only) */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Account info</Text>
          <InfoRow label="Provider ID"   value={user?.uid}         mono />
          <InfoRow label="Member since"  value={memberSince} />
          <InfoRow label="Account type"  value="Service provider" />
          <InfoRow label="Status"        value={profile?.status === 'verified' ? '✓ Verified' : profile?.status || '—'} />
        </View>

        {/* Service categories */}
        {categories.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>My services</Text>
            <View style={s.catsRow}>
              {categories.map(cat => (
                <View key={cat} style={s.catChip}>
                  <Text style={s.catEmoji}>{CAT_EMOJI[cat] || '🔧'}</Text>
                  <Text style={s.catLabel}>{cat}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Save button */}
        <TouchableOpacity style={s.btn} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>{saved ? '✓ Saved!' : 'Save changes'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#f5f5f5' },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:            { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  headerTitle:       { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  container:         { padding: 16, gap: 12 },

  avatarWrap:        { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff',
                       borderRadius: Radius.lg, ...Shadows.card },
  avatar:            { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
                       alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText:        { fontSize: 32, fontWeight: '700', color: '#fff' },
  avatarName:        { fontSize: 18, fontWeight: '700', color: Colors.gray900, marginBottom: 4 },
  avatarEmail:       { fontSize: 13, color: Colors.gray500, marginBottom: 10 },
  verifiedBadge:     { backgroundColor: '#e6f4ea', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99 },
  verifiedText:      { fontSize: 12, color: '#2d7a3a', fontWeight: '700' },

  card:              { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16, ...Shadows.card },
  sectionTitle:      { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginBottom: 16 },

  fieldWrap:         { marginBottom: 14 },
  label:             { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 6 },
  input:             { borderWidth: 1, borderColor: Colors.gray200, borderRadius: Radius.md,
                       padding: 12, fontSize: 15, color: Colors.gray900, backgroundColor: '#fff' },
  inputReadOnly:     { borderWidth: 1, borderColor: Colors.gray100, borderRadius: Radius.md,
                       padding: 12, backgroundColor: Colors.gray50 },
  inputReadOnlyText: { fontSize: 15, color: Colors.gray500 },

  infoRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                       paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  infoLabel:         { fontSize: 13, color: Colors.gray500, flex: 1 },
  infoValue:         { fontSize: 13, color: Colors.gray900, fontWeight: '600', flex: 2, textAlign: 'right' },
  infoMono:          { fontFamily: 'monospace', fontSize: 11, color: Colors.gray600 },

  catsRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:           { flexDirection: 'row', alignItems: 'center', gap: 6,
                       backgroundColor: Colors.mintLight, borderRadius: Radius.full,
                       paddingHorizontal: 12, paddingVertical: 7 },
  catEmoji:          { fontSize: 16 },
  catLabel:          { fontSize: 13, fontWeight: '600', color: Colors.primaryDark },

  btn:               { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  btnText:           { color: '#fff', fontSize: 15, fontWeight: '700' },
  signOutBtn:        { backgroundColor: '#fff', borderRadius: Radius.md, padding: 14,
                       alignItems: 'center', borderWidth: 1, borderColor: '#ffcccc', ...Shadows.card },
  signOutText:       { color: '#e53e3e', fontSize: 15, fontWeight: '600' },

  // Stripe Connect payouts card — connected state
  payoutConnectedRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  payoutCheckCircle:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e6f4ea',
                          alignItems: 'center', justifyContent: 'center' },
  payoutCheck:          { fontSize: 18, color: '#2d7a3a', fontWeight: '800' },
  payoutConnectedTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray900 },
  payoutConnectedSub:   { fontSize: 12, color: Colors.gray500, marginTop: 2, lineHeight: 16 },
  payoutAcct:           { fontSize: 11, color: Colors.gray400, fontFamily: 'monospace', marginTop: 6 },
  payoutSecondaryBtn:   { paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md,
                          backgroundColor: Colors.gray50, borderWidth: 1, borderColor: Colors.gray200 },
  payoutSecondaryText:  { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  // Stripe Connect payouts card — setup-required state
  payoutSetupCard:      { borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: '#fdfff8' },
  payoutSetupBadge:     { fontSize: 10, fontWeight: '800', color: '#9A3412', letterSpacing: 0.8,
                          backgroundColor: '#FFEDD5', alignSelf: 'flex-start',
                          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 8 },
  payoutSetupTitle:     { fontSize: 18, fontWeight: '800', color: Colors.gray900, marginBottom: 6 },
  payoutSetupBody:      { fontSize: 13, color: Colors.gray600, lineHeight: 19, marginBottom: 14 },
  payoutPrimaryBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.md,
                          paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  payoutPrimaryBtnDisabled: { opacity: 0.6 },
  payoutPrimaryText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  payoutSetupFootnote:  { fontSize: 11, color: Colors.gray400, lineHeight: 16, textAlign: 'center' },
});
