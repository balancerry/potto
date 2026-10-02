/**
 * Theme preference: Light, Dark, or System (follow the device). Pure — storage
 * and the native appearance override live in lib/theme-storage.ts and
 * store/ThemeContext.tsx. Mirrors web/src/lib/theme.ts.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'Always use the light theme' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme' },
  { value: 'system', label: 'System', description: 'Match your device setting' },
];

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Value for `Appearance.setColorScheme`; 'unspecified' hands control back to the device (RN 0.86). */
export function schemeOverride(preference: ThemePreference): 'light' | 'dark' | 'unspecified' {
  return preference === 'system' ? 'unspecified' : preference;
}
