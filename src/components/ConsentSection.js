import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Colors, Radius } from '../utils/theme';

// GDPR consent block shown on signup. Parent controls state via `value`
// and `onChange`. Three keys: terms, privacy, photo — all required.

const TERMS_URL   = 'https://gofix.app/terms';
const PRIVACY_URL = 'https://gofix.app/privacy';

function Row({ checked, onToggle, children }) {
  return (
    <TouchableOpacity style={s.row} onPress={onToggle} activeOpacity={0.7}>
      <View style={[s.box, checked && s.boxChecked]}>
        {checked && <Text style={s.tick}>✓</Text>}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}

export default function ConsentSection({ value, onChange }) {
  const toggle = (key) => onChange({ ...value, [key]: !value[key] });
  const openLink = (url) => Linking.openURL(url).catch(() => {});

  return (
    <View style={s.card}>
      <Text style={s.title}>Privacy & consent <Text style={s.req}>*</Text></Text>
      <Text style={s.sub}>You must agree to all three before creating your account.</Text>

      <Row checked={value.terms} onToggle={() => toggle('terms')}>
        <Text style={s.text}>
          I agree to the{' '}
          <Text style={s.link} onPress={() => openLink(TERMS_URL)}>Terms of Service</Text>
        </Text>
      </Row>

      <Row checked={value.privacy} onToggle={() => toggle('privacy')}>
        <Text style={s.text}>
          I agree to the{' '}
          <Text style={s.link} onPress={() => openLink(PRIVACY_URL)}>Privacy Policy</Text>
          {' '}and consent to my data being processed under GDPR.
        </Text>
      </Row>

      <Row checked={value.photo} onToggle={() => toggle('photo')}>
        <Text style={s.text}>
          I consent to photos being captured and stored as part of service
          documentation (before/after work I perform).
        </Text>
      </Row>
    </View>
  );
}

export const allConsentsGiven = (value) =>
  !!value && value.terms === true && value.privacy === true && value.photo === true;

const s = StyleSheet.create({
  card:    { backgroundColor: '#f7f9f9', borderRadius: Radius.md, padding: 14,
             borderWidth: 1, borderColor: Colors.gray200, marginTop: 12, marginBottom: 4 },
  title:   { fontSize: 14, fontWeight: '800', color: Colors.gray900 },
  req:     { color: '#EF4444' },
  sub:     { fontSize: 12, color: Colors.gray500, marginTop: 4, marginBottom: 12 },
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  box:     { width: 22, height: 22, borderRadius: 5, borderWidth: 2,
             borderColor: Colors.gray400, backgroundColor: '#fff',
             justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  boxChecked:{ backgroundColor: Colors.primary, borderColor: Colors.primary },
  tick:    { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 16 },
  text:    { fontSize: 13, color: Colors.gray700, lineHeight: 19 },
  link:    { color: Colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
});
