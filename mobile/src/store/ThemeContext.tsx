import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Appearance, Platform, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { PottoPalette, usePottoColors } from '@/constants/potto-theme';
import { ForcedSchemeContext, useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { loadThemePreference, saveThemePreference } from '@/lib/theme-storage';
import { schemeOverride, type ThemePreference } from '@/logic/theme';

interface ThemeContextValue {
  /** What the user picked: light, dark or system. */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyOverride(preference: ThemePreference) {
  try {
    // Native chrome the JS tree does not draw (system alerts, pickers, keyboard) follows the choice;
    // 'unspecified' returns control to the device. Our own colors come from ForcedSchemeContext.
    Appearance.setColorScheme(schemeOverride(preference));
  } catch {
    // Not supported on this platform: the device setting stays in charge.
  }
}

/** Keeps the status bar and the window background in step with the active theme. */
function ThemeEffects() {
  const colors = usePottoColors();
  const scheme = useResolvedScheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.paper).catch(() => {});
  }, [colors.paper]);
  // Light content on a dark background and vice versa, from the resolved scheme (not the OS echo).
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Loads the saved preference before rendering the app, so the first frame is
 * already in the right theme. The native splash screen is still up during that
 * short read (see SplashScreen.preventAutoHideAsync in the root layout).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  // Expo Router's web static render has no storage to wait for.
  const [ready, setReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    let alive = true;
    void loadThemePreference().then((saved) => {
      if (!alive) return;
      applyOverride(saved);
      preferenceRef.current = saved;
      setPreferenceState(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const reduced = useReducedMotion();
  const device = useColorScheme();
  const fade = useSharedValue(0);
  const fadeColor = useSharedValue<string>(PottoPalette.light.paper);
  const preferenceRef = useRef<ThemePreference>('system');
  const pendingRef = useRef<ThemePreference | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const commit = useCallback((next: ThemePreference) => {
    // eslint-disable-next-line react-hooks/immutability -- refs are written from an event callback, not during render
    preferenceRef.current = next;
    pendingRef.current = null;
    applyOverride(next);
    setPreferenceState(next);
    void saveThemePreference(next);
  }, []);

  /**
   * Switching Light/Dark dissolves through the NEW theme's background: a full-screen layer fades
   * in (~120ms), the theme is swapped underneath it, then the layer fades out (~200ms). The whole
   * thing runs as one opacity animation on the UI thread, so there is no hard cut and no flash of
   * the old or a third color. Choosing System skips it (the device scheme is unknown until the
   * override is cleared). Reduced motion shortens it to a brief fade.
   */
  const setPreference = useCallback(
    (next: ThemePreference) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (pendingRef.current) commit(pendingRef.current); // a tap landed mid-fade: settle it first

      const current = preferenceRef.current === 'system' ? (device === 'dark' ? 'dark' : 'light') : preferenceRef.current;
      if (next === 'system' || next === current) {
        commit(next);
        fade.set(0);
        return;
      }
      pendingRef.current = next;
      const inMs = reduced ? 50 : 120;
      const outMs = reduced ? 90 : 200;
      fadeColor.set(PottoPalette[next].paper);
      fade.set(withTiming(1, { duration: inMs, easing: Easing.out(Easing.quad) }));
      timers.current.push(
        setTimeout(() => commit(next), inMs + 10),
        setTimeout(() => {
          fade.set(withTiming(0, { duration: outMs, easing: Easing.in(Easing.quad) }));
        }, inMs + 60),
      );
    },
    [commit, device, fade, fadeColor, reduced],
  );

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value, backgroundColor: fadeColor.value }));

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={value}>
      <ForcedSchemeContext.Provider value={preference === 'system' ? null : preference}>
        <ThemeEffects />
        <View style={styles.root}>
          {children}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fade, fadeStyle]} />
        </View>
      </ForcedSchemeContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used inside <ThemeProvider>');
  return ctx;
}

const styles = StyleSheet.create({ root: { flex: 1 }, fade: { zIndex: 999 } });
