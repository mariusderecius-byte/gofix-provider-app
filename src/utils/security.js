import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 30-minute inactivity timeout. Same shape as user-app/src/utils/security.js
// so the two apps share behaviour, even though the code is duplicated per app.

const INACTIVITY_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'gofix_provider_last_activity';

export async function touchActivity() {
  try { await AsyncStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now())); } catch {}
}

export async function isSessionExpiredByInactivity() {
  try {
    const raw = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    if (!raw) return false;
    const last = parseInt(raw, 10);
    return Date.now() - last > INACTIVITY_MS;
  } catch { return false; }
}

export async function clearActivity() {
  try { await AsyncStorage.removeItem(LAST_ACTIVITY_KEY); } catch {}
}

export function useInactivityTimeout(onTimeout, enabled = true) {
  const timerRef = useRef(null);

  const restart = () => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onTimeout?.(), INACTIVITY_MS);
    touchActivity();
  };

  useEffect(() => {
    if (!enabled) return;
    restart();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        if (await isSessionExpiredByInactivity()) onTimeout?.();
        else restart();
      }
    });
    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

  return restart;
}

// Failed-login lockout — 5 attempts → 15-min block per email
const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failKey = (email) => `gofix_provider_fail_${email.toLowerCase()}`;

export async function getLoginLockout(email) {
  if (!email) return null;
  try {
    const raw = await AsyncStorage.getItem(failKey(email));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.blockedUntil && Date.now() < data.blockedUntil) {
      return { blockedUntil: data.blockedUntil, count: data.count };
    }
    if (data.blockedUntil && Date.now() >= data.blockedUntil) {
      await AsyncStorage.removeItem(failKey(email));
    }
    return null;
  } catch { return null; }
}

export async function recordFailedLogin(email) {
  if (!email) return null;
  try {
    const raw = await AsyncStorage.getItem(failKey(email));
    const data = raw ? JSON.parse(raw) : { count: 0, blockedUntil: null };
    data.count = (data.count || 0) + 1;
    if (data.count >= MAX_FAILS) {
      data.blockedUntil = Date.now() + LOCKOUT_MS;
    }
    await AsyncStorage.setItem(failKey(email), JSON.stringify(data));
    return data;
  } catch { return null; }
}

export async function clearLoginFails(email) {
  if (!email) return;
  try { await AsyncStorage.removeItem(failKey(email)); } catch {}
}

export function formatLockoutTime(ms) {
  if (!ms) return '';
  const mins = Math.ceil((ms - Date.now()) / 60000);
  if (mins <= 1) return 'less than a minute';
  return `${mins} minutes`;
}
