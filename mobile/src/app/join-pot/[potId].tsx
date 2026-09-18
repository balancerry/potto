import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/potto/EmptyState';
import { JoinPotFlow } from '@/components/potto/JoinPotFlow';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { usePottoStore } from '@/store/PottoStore';

/**
 * Landed on after a Join Code (manual entry or QR) resolved successfully in
 * src/app/join-pot/index.tsx. Re-checks the Pot still exists/isn't archived
 * (defense in depth against it changing between resolve and this screen),
 * then hands off to the SAME JoinPotFlow the invite-link screen uses.
 */
export default function JoinPotResolvedScreen() {
  const { potId } = useLocalSearchParams<{ potId: string }>();
  const colors = usePottoColors();
  const { getPot } = usePottoStore();
  const pot = getPot(potId);

  if (!pot || pot.status === 'archived') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Join a Pot" onBack={() => router.back()} />
        <EmptyState icon="🔗" title="Not available" subtitle="This Pot can no longer be joined this way." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Join a Pot" onBack={() => router.back()} />
      <JoinPotFlow pot={pot} channel="join_code" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
