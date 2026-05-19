import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Switch, ActivityIndicator, Alert,
} from 'react-native';
import { Colors, Radius } from '../utils/theme';

const SLOTS = [
  { id: 'now', label: 'Available now', sub: 'Show me for immediate jobs' },
  { id: 'weekdays', label: 'Weekdays', sub: 'Monday to Friday' },
  { id: 'weekends', label: 'Weekends', sub: 'Saturday and Sunday' },
  { id: 'evenings', label: 'Evenings', sub: 'After 18:00' },
  { id: 'emergency', label: 'Emergency calls', sub: 'Urgent jobs any time' },
];

export default function AvailabilityScreen() {
  const [availability, setAvailability] = useState({
    now: true, weekdays: true, weekends: false, evenings: false, emergency: false,
  });
  const [holiday, setHoliday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = id => setAvailability(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSave = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Availability</Text>
      </View>

      <ScrollView contentContainerStyle={s.container}>
        <View style={s.card}>
          <View style={s.holidayRow}>
            <View style={s.holidayText}>
              <Text style={s.holidayTitle}>Holiday mode</Text>
              <Text style={s.holidaySub}>Hide me from all job matches</Text>
            </View>
            <Switch value={holiday} onValueChange={setHoliday}
              trackColor={{ true: '#e53e3e' }} thumbColor="#fff" />
          </View>
        </View>

        {holiday ? (
          <View style={s.holidayAlert}>
            <Text style={s.holidayAlertText}>You are in holiday mode. You won't receive any new jobs until you turn this off.</Text>
          </View>
        ) : (
          <>
            <Text style={s.sectionTitle}>When are you available?</Text>
            <View style={s.card}>
              {SLOTS.map((slot, i) => (
                <View key={slot.id} style={[s.slotRow, i < SLOTS.length - 1 && s.slotBorder]}>
                  <View style={s.slotText}>
                    <Text style={s.slotLabel}>{slot.label}</Text>
                    <Text style={s.slotSub}>{slot.sub}</Text>
                  </View>
                  <Switch value={availability[slot.id]} onValueChange={() => toggle(slot.id)}
                    trackColor={{ true: Colors.primary }} thumbColor="#fff" />
                </View>
              ))}
            </View>

            <View style={s.summaryCard}>
              <Text style={s.summaryTitle}>Your availability summary</Text>
              <Text style={s.summaryText}>
                {Object.entries(availability).filter(([,v]) => v).map(([k]) =>
                  SLOTS.find(s => s.id === k)?.label
                ).join(', ') || 'No availability set'}
              </Text>
            </View>

            <TouchableOpacity style={s.btn} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> :
                <Text style={s.btnText}>{saved ? 'Saved!' : 'Save availability'}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.gray900 },
  container: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: 16 },
  holidayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  holidayText: { flex: 1 },
  holidayTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginBottom: 2 },
  holidaySub: { fontSize: 13, color: Colors.gray500 },
  holidayAlert: { backgroundColor: '#fce8e8', borderRadius: Radius.md, padding: 16 },
  holidayAlertText: { fontSize: 14, color: '#c62828', lineHeight: 22 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray700 },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  slotBorder: { borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  slotText: { flex: 1 },
  slotLabel: { fontSize: 14, fontWeight: '600', color: Colors.gray900, marginBottom: 2 },
  slotSub: { fontSize: 12, color: Colors.gray500 },
  summaryCard: { backgroundColor: '#f0f7ff', borderRadius: Radius.md, padding: 16 },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  summaryText: { fontSize: 13, color: Colors.gray700, lineHeight: 20 },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});