/**
 * Theme preference: Light, Dark, or System (follow the OS).
 *
 * The choice lives in localStorage so it survives refreshes, navigation and
 * sign-out. "System" stores nothing and leaves `data-theme` off the <html>
 * element, so globals.css follows `prefers-color-scheme` on its own; an explicit
 * choice sets `data-theme="light" | "dark"`, which wins over the OS.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'potto-theme';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
];

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/**
 * Runs in <head> before first paint so an explicit choice never flashes the
 * wrong theme. Must stay tiny, dependency-free and wrapped in try/catch
 * (localStorage throws in some private modes).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})();`;
