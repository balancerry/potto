import { router } from 'expo-router';
import { Moon, Sun } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePottoColors } from '@/constants/potto-theme';
import { useResolvedScheme } from '@/hooks/use-resolved-scheme';
import { useThemePreference } from '@/store/ThemeContext';

/**
 * One-tap light/dark button (home top bar, shared-pot header). The icon shows the CURRENT theme:
 * on a switch the outgoing icon turns half a revolution while shrinking to 0.85 and fading, and
 * the incoming one turns in and grows back to 1 (transform + opacity only, on the UI thread, in a
 * fixed 36px circle so nothing moves). Long-press opens the Appearance screen, which also offers
 * System. Reduced motion: no turn or scale, just a short cross-fade.
 */
export function ThemeToggleButton() {
  const colors = usePottoColors();
  const scheme = useResolvedScheme();
  const { setPreference } = useThemePreference();
  const reduced = useReducedMotion();
  const isDark = scheme === 'dark';

  const progress = useSharedValue(isDark ? 1 : 0); // 0 = sun, 1 = moon
  const press = useSharedValue(1);
  const target = useRef(isDark ? 1 : 0);

  const animateTo = (value: number) => {
    target.current = value;
    progress.set(withTiming(value, { duration: reduced ? 120 : 350, easing: Easing.inOut(Easing.cubic) }));
  };

  // Keep in step when the theme changes from elsewhere (Appearance screen, device setting).
  useEffect(() => {
    const value = isDark ? 1 : 0;
    if (target.current !== value) animateTo(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  const sunStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.7], [1, 0], 'clamp'),
    transform: [
      { rotate: `${reduced ? 0 : progress.value * 180}deg` },
      { scale: reduced ? 1 : interpolate(progress.value, [0, 1], [1, 0.85]) },
    ],
  }));
  const moonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 1], [0, 1], 'clamp'),
    transform: [
      { rotate: `${reduced ? 0 : (progress.value - 1) * 180}deg` },
      { scale: reduced ? 1 : interpolate(progress.value, [0, 1], [0.85, 1]) },
    ],
  }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }], opacity: reduced ? interpolate(press.value, [0.92, 1], [0.6, 1]) : 1 }));

  const next = isDark ? 'light' : 'dark';
  const openAppearance = () => router.push('/appearance');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${next} theme`}
      accessibilityHint="Long press for appearance settings"
      accessibilityActions={[{ name: 'longpress', label: 'Appearance settings' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && openAppearance()}
      hitSlop={8}
      onPressIn={() => press.set(withTiming(0.92, { duration: 90 }))}
      onPressOut={() => press.set(withTiming(1, { duration: 140 }))}
      onPress={() => {
        animateTo(isDark ? 0 : 1);
        setPreference(next);
      }}
      onLongPress={openAppearance}>
      <Animated.View style={[styles.btn, { borderColor: colors.line, backgroundColor: colors.surface }, pressStyle]}>
        <Animated.View style={[styles.icon, sunStyle]}>
          <Sun size={18} color={colors.ink} strokeWidth={1.75} />
        </Animated.View>
        <Animated.View style={[styles.icon, moonStyle]}>
          <Moon size={18} color={colors.ink} strokeWidth={1.75} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
