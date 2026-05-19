import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Colors, Radius } from '../utils/theme';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Missing info', 'Please enter your email and password.');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      Alert.alert('Login failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.logoWrap}>
          <View style={s.logo}><Text style={s.logoText}>G</Text></View>
          <Text style={s.appName}>GoFix Provider</Text>
          <Text style={s.tagline}>Manage your jobs and earnings</Text>
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} placeholder="you@email.com"
            placeholderTextColor={Colors.gray400} value={email}
            onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={s.fieldWrap}>
          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} placeholder="Your password"
            placeholderTextColor={Colors.gray400} value={password}
            onChangeText={setPassword} secureTextEntry />
        </View>

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign in</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Signup')}>
          <Text style={s.linkText}>New provider? <Text style={s.linkBold}>Apply to join</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, paddingTop: 80 },
  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { fontSize: 36, fontWeight: '700', color: '#fff' },
  appName: { fontSize: 24, fontWeight: '700', color: Colors.gray900, marginBottom: 4 },
  tagline: { fontSize: 14, color: Colors.gray500 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: Colors.gray200, borderRadius: Radius.md,
    padding: 12, fontSize: 15, color: Colors.gray900 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md,
    padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: 24 },
  linkText: { fontSize: 14, color: Colors.gray500 },
  linkBold: { color: Colors.primary, fontWeight: '600' },
});