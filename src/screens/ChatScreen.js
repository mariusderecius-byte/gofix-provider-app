import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
  SafeAreaView, Image,
} from 'react-native';
import {
  collection, doc, getDoc, addDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { Colors, Radius, Shadows } from '../utils/theme';

const READ_ONLY_STATUSES = ['completed', 'cancelled', 'cancelled_by_user', 'cancelled_by_provider', 'disputed'];

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const { jobId }  = useRoute().params || {};
  const { user }   = useAuth();

  const [job,       setJob]       = useState(null);
  const [customer,  setCustomer]  = useState(null);
  const [messages,  setMessages]  = useState([]);
  const [draft,     setDraft]     = useState('');
  const [sending,   setSending]   = useState(false);
  const listRef = useRef(null);

  // Live job + customer info for header
  useEffect(() => {
    if (!jobId) return;
    const unsub = onSnapshot(doc(db, 'jobs', jobId), async snap => {
      if (!snap.exists()) return;
      const j = snap.data();
      setJob(j);
      if (j.userId && !customer) {
        try {
          const uSnap = await getDoc(doc(db, 'users', j.userId));
          if (uSnap.exists()) setCustomer({ id: uSnap.id, ...uSnap.data() });
        } catch (e) { console.warn('[Chat] customer fetch failed', e.message); }
      }
    });
    return unsub;
  }, [jobId]);

  // Live messages
  useEffect(() => {
    if (!jobId) return;
    const q = query(
      collection(db, 'jobs', jobId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`[Chat] ${msgs.length} messages for job ${jobId}`);
      setMessages(msgs);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }, err => console.error('[Chat] messages listener:', err));
    return unsub;
  }, [jobId]);

  const readOnly = !job || READ_ONLY_STATUSES.includes(job.status);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !jobId || !user?.uid || sending) return;
    setSending(true);
    setDraft('');
    try {
      await addDoc(collection(db, 'jobs', jobId, 'messages'), {
        senderId:   user.uid,
        senderRole: 'provider',
        text,
        createdAt:  serverTimestamp(),
      });
    } catch (e) {
      console.error('[Chat] send failed:', e);
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const otherName = customer?.name || job?.userName || 'Customer';
  const initials = otherName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        {customer?.photoUrl ? (
          <Image source={{ uri: customer.photoUrl }} style={s.headerAvatar} />
        ) : (
          <View style={[s.headerAvatar, s.headerAvatarFallback]}>
            <Text style={s.headerAvatarText}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.headerName} numberOfLines={1}>{otherName}</Text>
          <Text style={s.headerSub}>
            {job?.category}{job?.status ? ` · ${job.status.replace(/_/g, ' ')}` : ''}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={s.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>Say hello 👋</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === user?.uid;
            return (
              <View style={[s.bubbleRow, mine ? s.bubbleRowMine : s.bubbleRowTheirs]}>
                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                  <Text style={[s.bubbleText, mine && s.bubbleTextMine]}>{item.text}</Text>
                  <Text style={[s.bubbleTime, mine && s.bubbleTimeMine]}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            );
          }}
        />

        {readOnly ? (
          <View style={s.readOnlyBar}>
            <Text style={s.readOnlyText}>
              💬 Chat is read-only — {job?.status === 'completed' ? 'job complete' : 'job ended'}
            </Text>
          </View>
        ) : (
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message…"
              placeholderTextColor={Colors.gray400}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!draft.trim() || sending) && s.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!draft.trim() || sending}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.sendBtnText}>Send</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#f5f5f5' },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 12, paddingVertical: 10,
                    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  backBtn:        { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backTxt:        { fontSize: 24, color: Colors.gray900, fontWeight: '500' },
  headerAvatar:   { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: { backgroundColor: Colors.mint, justifyContent: 'center', alignItems: 'center' },
  headerAvatarText: { fontSize: 12, fontWeight: '800', color: Colors.tealDark },
  headerName:     { fontSize: 15, fontWeight: '700', color: Colors.gray900 },
  headerSub:      { fontSize: 11, color: Colors.gray500, marginTop: 1, textTransform: 'capitalize' },

  list:           { padding: 12, gap: 4, flexGrow: 1 },
  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText:      { fontSize: 14, color: Colors.gray400 },

  bubbleRow:      { flexDirection: 'row', marginVertical: 2 },
  bubbleRowMine:  { justifyContent: 'flex-end' },
  bubbleRowTheirs:{ justifyContent: 'flex-start' },
  bubble:         { maxWidth: '78%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18 },
  bubbleMine:     { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs:   { backgroundColor: '#fff', borderBottomLeftRadius: 4, ...Shadows.card },
  bubbleText:     { fontSize: 14.5, color: Colors.gray900, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime:     { fontSize: 10, color: Colors.gray400, marginTop: 3, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },

  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8,
                    paddingHorizontal: 12, paddingVertical: 10,
                    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: Colors.gray100 },
  input:          { flex: 1, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 10,
                    fontSize: 15, color: Colors.gray900,
                    backgroundColor: Colors.gray50, borderRadius: 20,
                    borderWidth: 1, borderColor: Colors.gray200 },
  sendBtn:        { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10,
                    borderRadius: 20, justifyContent: 'center', minWidth: 64, alignItems: 'center' },
  sendBtnDisabled:{ backgroundColor: Colors.gray200 },
  sendBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },

  readOnlyBar:    { paddingVertical: 14, paddingHorizontal: 16,
                    backgroundColor: Colors.gray50, borderTopWidth: 1, borderTopColor: Colors.gray100,
                    alignItems: 'center' },
  readOnlyText:   { fontSize: 13, color: Colors.gray500, fontWeight: '600' },
});
