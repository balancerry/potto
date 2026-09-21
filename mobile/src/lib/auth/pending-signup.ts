import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'potto.pendingSignup';

export type PendingSignup = {
  email: string;
  name: string;
  password: string;
  createdAt: number;
};

const MAX_AGE_MS = 60 * 60 * 1000;

async function setItem(value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(KEY, value);
  } else {
    await SecureStore.setItemAsync(KEY, value);
  }
}

async function getItem(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

async function removeItem() {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(KEY);
  } else {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Holds password only until magic-link verification completes — never logged. */
export function savePendingSignup(data: Omit<PendingSignup, 'createdAt'>): void {
  const payload: PendingSignup = { ...data, createdAt: Date.now() };
  void setItem(JSON.stringify(payload));
}

export async function readPendingSignup(): Promise<PendingSignup | null> {
  try {
    const raw = await getItem();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    if (!parsed?.email || !parsed?.password) {
      await clearPendingSignup();
      return null;
    }
    if (Date.now() - (parsed.createdAt || 0) > MAX_AGE_MS) {
      await clearPendingSignup();
      return null;
    }
    return parsed;
  } catch {
    await clearPendingSignup();
    return null;
  }
}

export async function clearPendingSignup(): Promise<void> {
  await removeItem();
}
