import { StyleSheet, Text, View } from 'react-native';

import { PottoPalette } from '@/constants/potto-theme';

const WORDMARK = PottoPalette.light.accent;
const TAGLINE = '#5F6F66';

/** Brand lockup used on launch splash / auth boot gate. */
export function BrandSplashLockup() {
  return (
    <View style={styles.lockup}>
      <Text style={styles.wordmark}>potto</Text>
      <Text style={styles.tagline}>Your group. Your money. One Pot.</Text>
      <View style={styles.dash} />
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
    color: WORDMARK,
    textTransform: 'lowercase',
  },
  tagline: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: TAGLINE,
    textAlign: 'center',
  },
  dash: {
    marginTop: 22,
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: WORDMARK,
  },
});
