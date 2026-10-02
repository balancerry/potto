import { StyleSheet, Text, View } from 'react-native';

import { usePottoColors } from '@/constants/potto-theme';

/** Brand lockup used on launch splash / auth boot gate. Follows the active theme. */
export function BrandSplashLockup() {
  const colors = usePottoColors();
  return (
    <View style={styles.lockup}>
      <Text style={[styles.wordmark, { color: colors.accent }]}>potto</Text>
      <Text style={[styles.tagline, { color: colors.inkSoft }]}>Your group. Your money. One Pot.</Text>
      <View style={[styles.dash, { backgroundColor: colors.accent }]} />
    </View>
  );
}

/** @deprecated Splash is gated by AuthBootstrap — kept for web stub exports. */
export function AnimatedSplashOverlay() {
  return null;
}

const styles = StyleSheet.create({
  lockup: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    textTransform: 'lowercase',
  },
  tagline: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  dash: {
    marginTop: 22,
    width: 36,
    height: 5,
    borderRadius: 999,
  },
});
