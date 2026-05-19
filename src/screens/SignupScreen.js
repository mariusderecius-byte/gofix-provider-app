import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import ConsentSection, { allConsentsGiven } from '../components/ConsentSection';
import { Colors, Radius } from '../utils/theme';

const CATEGORIES = ['Plumbing', 'Electrical', 'Cleaning', 'Gardening', 'Painting', 'Handyman'];

export default function SignupScreen() {
  const navigation = useNavigation();
  const { signup: signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState('');
  const [experience, setExperience] = useState('');
  const [consents,  setConsents] = useState({ terms: false, privacy: false, photo: false });
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password || !category) {
      return Alert.alert('Missing info', 'Please fill in all required fields and select a category.');
    }
    if (!allConsentsGiven(consents)) {
      return Alert.alert('Consent required', 'Please agree to the Terms, Privacy Policy, and photo consent before continuing.');
    }
    setLoading(true);
    try {
      await signUp(email, password, name, phone, [category], consents);
    } catch (e) {
      Alert.alert('Sign up failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = name && email && password && category && allConsentsGiven(consents);

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Apply to join</Text>
        <Text style={s.sub}>Become a verified GoFix professional</Text>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Full name *</Text>
          <TextInput style={s.input} placeholder="Your full name"
            placeholderTextColor={Colors.gray400} value={name}
            onChangeText={setName} autoCapitalize="words" />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Email *</Text>
          <TextInput style={s.input} placeholder="you@email.com"
            placeholderTextColor={Colors.gray400} value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Phone *</Text>
          <TextInput style={s.input} placeholder="+370 600 00000"
            placeholderTextColor={Colors.gray400} value={phone}
            onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Password *</Text>
          <TextInput style={s.input} placeholder="Min. 6 characters"
            placeholderTextColor={Colors.gray400} value={password}
            onChangeText={setPassword} secureTextEntry />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Service category *</Text>
          <View style={s.categoryGrid}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c}
                style={[s.catBtn, category === c && s.catBtnActive]}
                onPress={() => setCategory(c)}>
                <Text style={[s.catText, category === c && s.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Years of experience</Text>
          <TextInput style={s.input} placeholder="e.g. 5"
            placeholderTextColor={Colors.gray400} value={experience}
            onChangeText={setExperience} keyboardType="number-pad" />
        </View>

        <ConsentSection value={consents} onChange={setConsents} />

        <TouchableOpacity
          style={[s.btn, (!canSubmit || loading) && s.btnDisabled]}
          onPress={handleSignup}
          disabled={!canSubmit || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>
                {!allConsentsGiven(consents) ? 'Accept terms to continue' : 'Submit application'}
              </Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Login')}>
          <Text style={s.linkText}>Already registered? <Text style={s.linkBold}>Sign in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.gray900, marginBottom: 6 },
  sub: { fontSize: 15, color: Colors.gray500, marginBottom: 32 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: Radius.md,
    padding: 12, fontSize: 15, color: Colors.gray900 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
    borderWidth: 1, borderColor: Colors.gray200, backgroundColor: '#fff' },
  catBtnActive: { borderColor: Colors.primary, backgroundColor: '#f0f7ff' },
  catText: { fontSize: 13, color: Colors.gray600 },
  catTextActive: { color: Colors.primary, fontWeight: '600' },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: 16, alignItems: 'center', marginTop: 12 },
  btnDisabled: { backgroundColor: Colors.gray200 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: 24 },
  linkText: { fontSize: 14, color: Colors.gray500 },
  linkBold: { color: Colors.primary, fontWeight: '600' },
});