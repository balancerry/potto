import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { EmptyState } from '@/components/potto/EmptyState';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import type { ResolvedPotSummary } from '@/lib/api/resolve';
import type { JoinChannel } from '@/logic/join-requests';
import { usePottoStore } from '@/store/PottoStore';

type FlowView = 'summary' | 'identity' | 'pending' | 'already_member' | 'already_pending' | 'blocked';

const CHANNEL_NOUN: Record<JoinChannel, string> = {
  invite_link: 'invite',
  join_code: 'join code',
};

/**
 * Shared join-request UI for invite links and join codes.
 * Uses a public pot summary from resolve_* RPCs — the pot need not be in the local workspace.
 */
export function JoinPotFlow({
  pot,
  channel,
  initialStatus = null,
}: {
  pot: ResolvedPotSummary;
  channel: JoinChannel;
  initialStatus?: 'already_member' | 'already_pending' | null;
}) {
  const colors = usePottoColors();
  const { state, requestToJoin } = usePottoStore();
  const noun = CHANNEL_NOUN[channel];

  const [view, setView] = useState<FlowView>(() => {
    if (pot.status === 'archived' || !pot.enabled) return 'blocked';
    if (initialStatus === 'already_member') return 'already_member';
    if (initialStatus === 'already_pending') return 'already_pending';
    return 'summary';
  });
  const [requestedName, setRequestedName] = useState(state.currentUserName || state.currentUser.name);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  const sendRequest = async () => {
    if (!requestedName.trim() || sending) return;
    setSending(true);
    setErrorMessage(undefined);
    try {
      const result = await requestToJoin({ potId: pot.id, requestedName, channel });
      if (!result.ok) {
        setErrorMessage(
          result.reason === 'pot_archived'
            ? 'This Pot is no longer accepting new members.'
            : `This ${noun} can no longer accept requests. Ask the admin for a new one.`,
        );
        return;
      }
      if (result.status === 'already_member') {
        setView('already_member');
      } else if (result.status === 'already_pending') {
        setView('already_pending');
      } else {
        setView('pending');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not send join request');
    } finally {
      setSending(false);
    }
  };

  if (view === 'blocked') {
    return (
      <EmptyState
        icon="⏸️"
        title="Can't join this pot"
        subtitle={
          pot.status === 'archived'
            ? 'This Pot is archived and no longer accepting new members.'
            : `This ${noun} has been disabled by the admin.`
        }
      />
    );
  }

  return (
    <>
      {view === 'summary' && (
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.ink }]}>{pot.name}</Text>
          <Text style={[styles.sub, { color: colors.inkSoft }]}>
            {pot.description?.trim() || `You've been invited to join this Pot via ${noun}.`}
          </Text>

          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Stat label="Members" value={String(pot.memberCount)} colors={colors} />
            <Stat label="Status" value={pot.status === 'active' ? 'Active' : pot.status} colors={colors} />
          </View>

          <View style={styles.actions}>
            <PrimaryButton label="Request to Join" onPress={() => setView('identity')} fullWidth />
          </View>
        </View>
      )}

      {view === 'identity' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.ink }]}>How should we identify you?</Text>
            <TextInput
              value={requestedName}
              onChangeText={setRequestedName}
              placeholder="Your name"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
            <Text style={[styles.helper, { color: colors.inkSoft }]}>
              The Pot admin will review your request before giving access.
            </Text>
            {!!errorMessage && <Text style={[styles.helper, { color: colors.neg }]}>{errorMessage}</Text>}
            <View style={styles.actions}>
              <PrimaryButton
                label={sending ? 'Sending…' : 'Send Join Request'}
                onPress={sendRequest}
                fullWidth
                disabled={!requestedName.trim() || sending}
                loading={sending}
              />
              <View style={styles.spacer8} />
              <SecondaryButton label="Back" onPress={() => setView('summary')} fullWidth />
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {view === 'pending' && (
        <EmptyState
          icon="⏳"
          title="Request sent"
          subtitle={`Your request to join ${pot.name} is waiting for admin approval. We'll let you know when it's approved.`}
        />
      )}

      {view === 'already_pending' && (
        <EmptyState
          icon="⏳"
          title="Request already sent"
          subtitle={`Your join request for ${pot.name} is waiting for admin approval.`}
        />
      )}

      {view === 'already_member' && (
        <View style={styles.body}>
          <EmptyState icon="✅" title="You're already a member" subtitle={`You already have access to ${pot.name}.`} />
          <PrimaryButton label="Open Pot" onPress={() => router.replace(`/pot/${pot.id}`)} fullWidth />
        </View>
      )}
    </>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof usePottoColors> }) {
  return (
    <View style={styles.statCol}>
      <Text style={[styles.statValue, { color: colors.ink }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.inkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  sub: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  statsCard: { flexDirection: 'row', borderRadius: Radius.lg, borderWidth: 1, padding: 16, gap: 8 },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  statLabel: { fontSize: 11.5, marginTop: 3 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15, marginTop: 16 },
  helper: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  actions: { paddingTop: 24 },
  spacer8: { height: 8 },
});
