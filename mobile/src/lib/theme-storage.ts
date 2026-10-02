import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { parseThemePreference, type ThemePreference } from '@/logic/theme';

/** Survives restarts, logout/login and navigation; "system" stores nothing. */
export const THEME_STORAGE_KEY = 'potto.theme';

/** Expo Router's web SSR has no `window`, and AsyncStorage's web implementation needs it. */
function storageAvailable(): boolean {
  return Platform.OS !== 'web' || typeof window !== 'undefined';
}

/** Never throws: a missing or failing store just means "system". */
export async function loadThemePreference(): Promise<ThemePreference> {
  if (!storageAvailable()) return 'system';
  try {
    return parseThemePreference(await AsyncStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export async function saveThemePreference(preference: ThemePreference): Promise<void> {
  if (!storageAvailable()) return;
  try {
    if (preference === 'system') await AsyncStorage.removeItem(THEME_STORAGE_KEY);
    else await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage failed: the choice still applies for this session.
  }
}
