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
  resolveInviteCodeRemote,
  type ResolvedPotSummary,
} from '@/lib/api/resolve';

/**
 * Invite-link entry. Resolves via Supabase so deep links work for users who
 * are not yet members of the pot.
 */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const colors = usePottoColors();
  const [pot, setPot] = useState<ResolvedPotSummary | null>(null);
  const [initialStatus, setInitialStatus] = useState<'already_member' | 'already_pending' | null>(null);
  const [fail, setFail] = useState<{ icon: string; title: string; subtitle: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resolved = await resolveInviteCodeRemote(code ?? '');
        if (cancelled) return;
        if (!resolved) {
          setFail({
            icon: '🔗',
            title: 'Invalid invite',
            subtitle: 'This invite link doesn’t match any Pot. Ask for a fresh link.',
          });
          return;
        }
        if (resolved.status === 'archived') {
          setFail({
            icon: '📦',
            title: 'Pot archived',
            subtitle: 'This Pot has been archived and is no longer accepting new members.',
          });
          return;
        }
        if (!resolved.enabled) {
          setFail({
            icon: '⏸️',
            title: 'Invite disabled',
            subtitle: 'The admin has turned off this invite link. Ask them to re-enable it or send a new one.',
          });
          return;
        }
        const status = await getJoinStatusForPot(resolved.id);
        if (cancelled) return;
        setPot(resolved);
        setInitialStatus(status);
      } catch (err) {
        if (!cancelled) {
          setFail({
            icon: '🔗',
            title: 'Could not open invite',
            subtitle: err instanceof Error ? err.message : 'Something went wrong.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Invite" onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (fail || !pot) {
    const copy = fail ?? {
      icon: '🔗',
      title: 'Invalid invite',
      subtitle: 'This invite link doesn’t match any Pot. Ask for a fresh link.',
    };
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Invite" onBack={() => router.back()} />
        <EmptyState icon={copy.icon} title={copy.title} subtitle={copy.subtitle} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Invite" onBack={() => router.back()} />
      <JoinPotFlow pot={pot} channel="invite_link" initialStatus={initialStatus} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
