import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[Potto] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobile/.env.example to mobile/.env',
  );
}

/**
 * AsyncStorage web impl needs `window` (Expo Router SSR has none).
 * On native, wrap calls so a missing native module cannot crash auth boot.
 * Use AsyncStorage 2.x (Expo Go); 3.x throws "Native module is null".
 */
const memoryStore = new Map<string, string>();

function canUsePersistentStorage(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined';
}

async function storageGet(key: string): Promise<string | null> {
  if (!canUsePersistentStorage()) return memoryStore.get(key) ?? null;
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  if (!canUsePersistentStorage()) {
    memoryStore.set(key, value);
    return;
  }
  try {
    await AsyncStorage.setItem(key, value);
    memoryStore.set(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

async function storageRemove(key: string): Promise<void> {
  memoryStore.delete(key);
  if (!canUsePersistentStorage()) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const authStorage: SupportedStorage = {
  getItem: (key) => storageGet(key),
  setItem: (key, value) => storageSet(key, value),
  removeItem: (key) => storageRemove(key),
};

const persist = canUsePersistentStorage();

/**
 * Shared Supabase project with Potto Web.
 * Never use the service-role key in the mobile client.
 */
export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    storage: authStorage,
    autoRefreshToken: persist,
    persistSession: persist,
    detectSessionInUrl: false,
  },
});

/** Deep-link callback for magic-link / recovery on device. */
export const MOBILE_AUTH_CALLBACK = 'potto://auth/callback';

export function siteUrl(): string {
  return (process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}
