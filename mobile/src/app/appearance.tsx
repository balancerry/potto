import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { ThemeSelector } from '@/components/potto/ThemeSelector';
import { usePottoColors } from '@/constants/potto-theme';

/** Theme settings. Reachable from the home top bar and from the read-only public pot viewer. */
export default function AppearanceScreen() {
  const colors = usePottoColors();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Appearance" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.inkSoft }]}>THEME</Text>
        <ThemeSelector />
        <Text style={[styles.hint, { color: colors.inkSoft }]}>
          System follows your device and switches with it. Light and Dark stay as you set them. This is saved on this
          device.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 20 },
  label: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 14 },
});
