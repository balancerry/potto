'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

interface ThemeContextValue {
  /** What the user picked: light, dark or system. */
  preference: ThemePreference;
  /** What is actually showing right now (system resolved against the OS). */
  resolvedTheme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((listener) => listener());
}

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/**
 * Turns on the color cross-fade (see html.theme-transition in globals.css) for the moment of a
 * user-initiated switch only. The class is added in the same task as the attribute change, so the
 * new styles' transition rules apply to that very change. Rapid clicks just extend the window.
 *
 * `color-scheme` is held at its previous value for the window and released afterwards. Flipping it
 * mid-fade makes Chrome cancel and restart every `color` transition on every frame (text creeps
 * instead of fading, then snaps), while the background still fades fine. Native scrollbars and form
 * controls therefore change ~450ms later, which is not noticeable.
 */
const TRANSITION_MS = 450;
let transitionTimer: number | undefined;
function beginThemeTransition() {
  const root = document.documentElement;
  if (!root.classList.contains('theme-transition')) {
    root.style.colorScheme = getComputedStyle(root).colorScheme.split(' ')[0];
  }
  root.classList.add('theme-transition');
  window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => {
    root.classList.remove('theme-transition');
    root.style.removeProperty('color-scheme');
  }, TRANSITION_MS);
}

function applyToDocument(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

function subscribePreference(onChange: () => void) {
  listeners.add(onChange);
  // Another tab changed the theme: mirror it here.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    applyToDocument(readPreference());
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Server and first client render both see 'system'/'light'; the real values
  // arrive right after hydration without a mismatch warning. <html data-theme> is
  // owned by the head script (first paint) and setPreference/storage events
  // (changes), never by a render-time effect, so hydration cannot undo it.
  const preference = useSyncExternalStore<ThemePreference>(subscribePreference, readPreference, () => 'system');
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );

  const resolvedTheme: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    beginThemeTransition();
    applyToDocument(next);
    emit();
  }, []);

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
