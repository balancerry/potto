import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Space, usePottoColors } from '@/constants/potto-theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const colors = usePottoColors();

  const entrance = useSharedValue(0);
  const float = useSharedValue(0);
  const press = useSharedValue(1);
  const coin = useSharedValue(0);
  const dropTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dropTimeout.current) clearTimeout(dropTimeout.current);
    };
  }, []);

  useEffect(() => {
    entrance.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    float.value = withDelay(
      300,
      withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })), -1, false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 14 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * -7 }, { scale: press.value }],
  }));

  const coinStyle = useAnimatedStyle(() => ({
    opacity: interpolate(coin.value, [0, 0.12, 0.75, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(coin.value, [0, 1], [-28, 4]) },
      { rotate: `${interpolate(coin.value, [0, 1], [-18, 22])}deg` },
    ],
  }));

  const handlePressIn = () => {
    // eslint-disable-next-line react-hooks/immutability -- reanimated SharedValue.value is intentionally mutable
    press.value = withTiming(0.88, { duration: 90 });
  };
  const handlePressOut = () => {
    // eslint-disable-next-line react-hooks/immutability -- reanimated SharedValue.value is intentionally mutable
    press.value = withSpring(1, { damping: 6, stiffness: 220 });
  };

  const isInteractive = !!onAction;
  const DROP_MS = 420;

  const handleIconTap = () => {
    if (!onAction) return;
    // eslint-disable-next-line react-hooks/immutability -- reanimated SharedValue.value is intentionally mutable
    coin.value = 0;
    coin.value = withTiming(1, { duration: DROP_MS, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/immutability -- reanimated SharedValue.value is intentionally mutable
    press.value = withSequence(withDelay(DROP_MS - 90, withTiming(0.85, { duration: 90 })), withSpring(1, { damping: 5, stiffness: 300 }));
    if (dropTimeout.current) clearTimeout(dropTimeout.current);
    dropTimeout.current = setTimeout(onAction, DROP_MS);
  };

  const body = (
    <Animated.View style={[styles.wrap, contentStyle]}>
      <View style={styles.iconWrap}>
        {isInteractive ? <Animated.Text style={[styles.coin, coinStyle]}>🪙</Animated.Text> : null}
        <Pressable
          onPress={isInteractive ? handleIconTap : undefined}
          onPressIn={isInteractive ? handlePressIn : undefined}
          onPressOut={isInteractive ? handlePressOut : undefined}
          disabled={!isInteractive}
          hitSlop={12}>
          <Animated.Text style={[styles.icon, iconStyle]}>{icon}</Animated.Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [styles.action, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : isInteractive ? (
        <Text style={[styles.hint, { color: colors.accent }]}>Tap to get started →</Text>
      ) : null}
    </Animated.View>
  );

  if (!isInteractive) return body;

  return (
    <Pressable onPress={onAction} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <View style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}>{body}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginHorizontal: Space.xl,
  },
  wrap: { paddingVertical: 48, paddingHorizontal: 32, alignItems: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'flex-end' },
  coin: { position: 'absolute', top: -20, fontSize: 18 },
  icon: { fontSize: 34, marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  action: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 22, borderRadius: Radius.pill },
  actionLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
  hint: { marginTop: 14, fontSize: 13.5, fontWeight: '600' },
});
