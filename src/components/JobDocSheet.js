import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable, Image,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadJobPhoto, saveJobDoc } from '../services/firebase';
import { Colors, Radius, Shadows } from '../utils/theme';

const COPY = {
  before: {
    title:       'Before you start',
    sub:         'Document the site before starting work',
    descLabel:   'What do you plan to do? *',
    descPlaceholder: 'e.g. Replace the leaking section of pipe under the sink and reseal the joint…',
    submitLabel: 'Start Job',
  },
  after: {
    title:       'Document the completed work',
    sub:         'Show the customer what you did',
    descLabel:   'What was done? *',
    descPlaceholder: 'e.g. Replaced 30cm of pipe, resealed the joint with PTFE tape, tested under pressure — no leaks…',
    submitLabel: 'Mark as Complete',
  },
};

export default function JobDocSheet({ visible, phase, jobId, onClose, onCompleted }) {
  const [photoUri,    setPhotoUri]    = useState(null);
  const [description, setDescription] = useState('');
  const [working,     setWorking]     = useState(false);

  useEffect(() => {
    if (visible) { setPhotoUri(null); setDescription(''); setWorking(false); }
  }, [visible, phase, jobId]);

  const pickPhoto = async (source) => {
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: false };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const offerPhoto = () => Alert.alert('Add photo', 'How would you like to add a photo?', [
    { text: 'Take photo', onPress: () => pickPhoto('camera') },
    { text: 'Choose from library', onPress: () => pickPhoto('library') },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const canSubmit = !!photoUri && description.trim().length > 0 && !working;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setWorking(true);
    try {
      console.log(`[JobDoc] uploading ${phase} photo for job ${jobId}…`);
      const url = await uploadJobPhoto(photoUri, jobId, phase);
      console.log(`[JobDoc] uploaded: ${url}`);
      await saveJobDoc(jobId, phase, url, description.trim());
      console.log(`[JobDoc] saved ${phase} doc fields on job`);
      onCompleted?.({ photoUrl: url, description: description.trim() });
      onClose?.();
    } catch (e) {
      console.error('[JobDoc] save failed:', e);
      Alert.alert('Upload failed', e.message || 'Could not save documentation. Try again.');
    } finally {
      setWorking(false);
    }
  };

  if (!visible) return null;
  const copy = COPY[phase] || COPY.before;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={working ? undefined : onClose}>
      <Pressable style={s.backdrop} onPress={working ? undefined : onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>{copy.title}</Text>
        <Text style={s.sub}>{copy.sub}</Text>

        {/* Photo */}
        <Text style={s.label}>Photo *</Text>
        {photoUri ? (
          <View style={s.photoPreviewWrap}>
            <Image source={{ uri: photoUri }} style={s.photoPreview} />
            <TouchableOpacity style={s.photoChange} onPress={offerPhoto}>
              <Text style={s.photoChangeText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.photoAdd} onPress={offerPhoto}>
            <Text style={s.photoAddIcon}>📷</Text>
            <Text style={s.photoAddLabel}>Take or choose a photo</Text>
          </TouchableOpacity>
        )}

        {/* Description */}
        <Text style={s.label}>{copy.descLabel}</Text>
        <TextInput
          style={s.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder={copy.descPlaceholder}
          placeholderTextColor={Colors.gray400}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {working
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitText}>
                {!photoUri ? 'Add photo to continue'
                 : description.trim().length === 0 ? 'Add description to continue'
                 : copy.submitLabel}
              </Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={working}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:       { position: 'absolute', left: 0, right: 0, bottom: 0,
                 backgroundColor: '#fff',
                 borderTopLeftRadius: 24, borderTopRightRadius: 24,
                 paddingTop: 10, paddingBottom: 26, paddingHorizontal: 20,
                 ...Shadows.modal },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray200,
                 alignSelf: 'center', marginBottom: 10 },
  title:       { fontSize: 20, fontWeight: '800', color: Colors.gray900, marginTop: 4 },
  sub:         { fontSize: 13, color: Colors.gray500, marginTop: 4, marginBottom: 18 },

  label:       { fontSize: 12, fontWeight: '700', color: Colors.gray700,
                 textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },

  photoAdd:    { backgroundColor: Colors.gray50, borderRadius: Radius.md,
                 borderWidth: 1.5, borderColor: Colors.gray200, borderStyle: 'dashed',
                 paddingVertical: 28, alignItems: 'center', gap: 8, marginBottom: 18 },
  photoAddIcon:{ fontSize: 32 },
  photoAddLabel:{ fontSize: 13, fontWeight: '600', color: Colors.gray500 },
  photoPreviewWrap:{ position: 'relative', marginBottom: 18, borderRadius: Radius.md, overflow: 'hidden' },
  photoPreview:{ width: '100%', height: 180 },
  photoChange: { position: 'absolute', top: 8, right: 8,
                 backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5,
                 borderRadius: 99 },
  photoChangeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  textarea:    { backgroundColor: Colors.gray50, borderRadius: Radius.md,
                 borderWidth: 1, borderColor: Colors.gray200,
                 padding: 12, fontSize: 14, color: Colors.gray900,
                 minHeight: 96, marginBottom: 18 },

  submitBtn:   { backgroundColor: Colors.primary, borderRadius: Radius.md,
                 paddingVertical: 15, alignItems: 'center', ...Shadows.card },
  submitBtnDisabled: { backgroundColor: Colors.gray200, shadowOpacity: 0 },
  submitText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn:   { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  cancelText:  { fontSize: 14, fontWeight: '600', color: Colors.gray500 },
});
