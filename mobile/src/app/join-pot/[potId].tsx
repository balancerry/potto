import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/potto/EmptyState';
import { JoinPotFlow } from '@/components/potto/JoinPotFlow';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import {
  getJoinStatusForPot,
  resolveJoinCodeRemote,
  type ResolvedPotSummary,
} from '@/lib/api/resolve';

/**
 * After a join code resolves, re-fetch the public pot summary and membership
 * status, then hand off to JoinPotFlow.
 */
export default function JoinPotResolvedScreen() {
  const { potId, code } = useLocalSearchParams<{ potId: string; code?: string }>();
  const colors = usePottoColors();
  const [pot, setPot] = useState<ResolvedPotSummary | null>(null);
  const [initialStatus, setInitialStatus] = useState<'already_member' | 'already_pending' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code?.trim()) {
        setError('Missing join code');
        setLoading(false);
        return;
      }
      try {
        const resolved = await resolveJoinCodeRemote(code);
        if (cancelled) return;
        if (!resolved || resolved.id !== potId) {
          setError('This Pot can no longer be joined this way.');
          setLoading(false);
          return;
        }
        const status = await getJoinStatusForPot(resolved.id);
        if (cancelled) return;
        setPot(resolved);
        setInitialStatus(status);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this pot');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [potId, code]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Join a Pot" onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !pot) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Join a Pot" onBack={() => router.back()} />
        <EmptyState icon="🔗" title="Not available" subtitle={error ?? 'This Pot can no longer be joined this way.'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Join a Pot" onBack={() => router.back()} />
      <JoinPotFlow pot={pot} channel="join_code" initialStatus={initialStatus} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
