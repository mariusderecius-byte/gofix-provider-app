import { createContext, useContext, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { getFirebaseAuth, db } from '../services/firebase';
import {
  getLoginLockout, recordFailedLogin, clearLoginFails, formatLockoutTime,
  useInactivityTimeout, clearActivity, touchActivity,
} from '../utils/security';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
  }, []);

  const login = async (email, password) => {
    const lockout = await getLoginLockout(email);
    if (lockout) {
      const wait = formatLockoutTime(lockout.blockedUntil);
      const err = new Error(`Too many failed attempts. Try again in ${wait}.`);
      err.code = 'auth/too-many-attempts';
      throw err;
    }
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      await clearLoginFails(email);
      await touchActivity();
      return cred;
    } catch (e) {
      await recordFailedLogin(email);
      throw e;
    }
  };

  const signup = async (email, password, name, phone, categories, consents) => {
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    const token = await cred.user.getIdToken();
    await axios.post(
      `${process.env.EXPO_PUBLIC_API_URL || 'https://gofix-backend-3u15.onrender.com/api/v1'}/auth/register/provider`,
      { uid: cred.user.uid, name, phone, email, categories },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Persist GDPR consent record on the provider doc (audit trail)
    if (consents) {
      await updateDoc(doc(db, 'providers', cred.user.uid), {
        consents: {
          terms:   !!consents.terms,
          privacy: !!consents.privacy,
          photo:   !!consents.photo,
        },
        consentedAt: new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      });
    }

    return cred;
  };

  const logout = async () => {
    await clearActivity();
    return signOut(getFirebaseAuth());
  };

  // Auto-sign-out after 30 minutes of inactivity
  useInactivityTimeout(() => {
    if (user) {
      console.log('[Auth] 30-min inactivity timeout — signing out');
      signOut(getFirebaseAuth()).catch(() => {});
      clearActivity();
    }
  }, !!user);

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
