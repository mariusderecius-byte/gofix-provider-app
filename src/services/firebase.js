import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize at module level — runs once when first imported
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let _auth;
try {
  _auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  _auth = getAuth(app);
}

export const firebaseApp   = app;
export const auth          = _auth;
export const db            = getFirestore(app);
export const storage       = getStorage(app);
export const getFirebaseAuth = () => _auth;
export function initFirebase() {} // no-op — kept for backward compat

// Upload a local image URI to Firebase Storage under jobs/{jobId}/{phase}-{ts}.jpg
// and return the public download URL. Used for before/after job docs so the
// user-app can render them cross-device.
export async function uploadJobPhoto(localUri, jobId, phase) {
  const response = await fetch(localUri);
  const blob     = await response.blob();
  const path     = `jobs/${jobId}/${phase}-${Date.now()}.jpg`;
  const fileRef  = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(fileRef);
}

// Write before/after documentation directly to the job doc (rules already
// allow providers to update their assigned job).
export async function saveJobDoc(jobId, phase, photoUrl, description) {
  const fields = phase === 'before'
    ? { beforePhoto: photoUrl, beforeDescription: description, beforeAt: new Date().toISOString() }
    : { afterPhoto:  photoUrl, afterDescription:  description, afterAt:  new Date().toISOString() };
  await updateDoc(doc(db, 'jobs', jobId), { ...fields, updatedAt: new Date().toISOString() });
}

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://gofix-backend-3u15.onrender.com/api/v1',
});

api.interceptors.request.use(async config => {
  if (_auth?.currentUser) {
    const token = await _auth.currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Jobs
export const listJobs           = p       => api.get('/jobs', { params: p });
export const getJob             = id      => api.get(`/jobs/${id}`);
export const updateJobStatus    = (id, status) => api.patch(`/jobs/${id}/status`, { status });
export const acceptJob          = id      => api.post(`/match/${id}/accept`);
export const declineJob         = id      => api.post(`/match/${id}/decline`);

// Provider
export const getMyProfile       = id      => api.get(`/providers/${id}`);
export const updateProfile      = (id, d) => api.patch(`/providers/${id}`, d);
export const updateAvailability = (id, d) => api.patch(`/providers/${id}/availability`, d);
export const updateLocation     = (id, lat, lng) => api.patch(`/providers/${id}/location`, { lat, lng });
export const getEarnings        = id      => api.get(`/providers/${id}/earnings`);
export const startKyc           = id      => api.post(`/providers/${id}/kyc`);
export const startStripeOnboard = id      => api.post(`/providers/${id}/stripe-onboard`);

export default api;
