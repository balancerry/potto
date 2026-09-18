import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/potto/EmptyState';
import { JoinPotFlow } from '@/components/potto/JoinPotFlow';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { resolveInvite } from '@/logic/join-requests';
import { usePottoStore } from '@/store/PottoStore';

// EXISTING invite-link screen — untouched behavior. Resolution + error copy
// stay exactly as before; only the summary/identity/pending body below was
// extracted into JoinPotFlow so the new Join Code screen can share it
// without a second join-request implementation.

const ERROR_COPY: Record<'invalid' | 'disabled' | 'archived', { icon: string; title: string; subtitle: string }> = {
  invalid: { icon: '🔗', title: 'Invalid invite', subtitle: 'This invite link doesn’t match any Pot. Ask for a fresh link.' },
  disabled: { icon: '⏸️', title: 'Invite disabled', subtitle: 'The admin has turned off this invite link. Ask them to re-enable it or send a new one.' },
  archived: { icon: '📦', title: 'Pot archived', subtitle: 'This Pot has been archived and is no longer accepting new members.' },
};

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const colors = usePottoColors();
  const { state } = usePottoStore();

  const resolution = useMemo(() => resolveInvite(state.pots, code ?? ''), [state.pots, code]);

  if (!resolution.ok) {
    const copy = ERROR_COPY[resolution.reason];
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
      <JoinPotFlow pot={resolution.pot} channel="invite_link" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
