import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { EmptyState } from '@/components/potto/EmptyState';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { calculateTotalContributions, calculateTotalSpent } from '@/logic/accounting';
import type { JoinChannel } from '@/logic/join-requests';
import { usePottoStore } from '@/store/PottoStore';
import type { JoinRequest, Pot } from '@/types/models';
import { formatMoney } from '@/utils/money';

type FlowView = 'summary' | 'identity' | 'pending' | 'already_member' | 'already_pending';

const CHANNEL_NOUN: Record<JoinChannel, string> = {
  invite_link: 'invite',
  join_code: 'join code',
};

/**
 * The public summary → identity → join-request flow shared by BOTH entry
 * points: the existing invite-link screen (src/app/join/[code].tsx) and the
 * new Join Code screen (src/app/join-pot/[potId].tsx). Resolution (by invite
 * code or by Join Code) happens in each caller before this renders — this
 * component only needs an already-resolved Pot and which channel the
 * requester came through, so there is exactly one join-request/member-linking
 * implementation regardless of how someone got here.
 */
export function JoinPotFlow({ pot, channel }: { pot: Pot; channel: JoinChannel }) {
  const colors = usePottoColors();
  const { state, getTransactions, getJoinRequests, requestToJoin } = usePottoStore();
  const txs = getTransactions(pot.id);
  const joinRequests = getJoinRequests(pot.id);
  const noun = CHANNEL_NOUN[channel];

  const existingActiveMember = pot.members.find((m) => m.status === 'active' && m.userId === state.currentUser.id);
  const existingPending = joinRequests.find((r) => r.userId === state.currentUser.id && r.status === 'pending');

  const [view, setView] = useState<FlowView>(() => {
    if (existingActiveMember) return 'already_member';
    if (existingPending) return 'already_pending';
    return 'summary';
  });
  const [requestedName, setRequestedName] = useState(state.currentUser.name);
  const [pendingRequest, setPendingRequest] = useState<JoinRequest | undefined>(existingPending);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const sendRequest = () => {
    if (!requestedName.trim()) return;
    const result = requestToJoin({ potId: pot.id, requestedName, channel });
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
      setPendingRequest(result.joinRequest);
      setView('already_pending');
    } else {
      setPendingRequest(result.joinRequest);
      setView('pending');
    }
  };

  return (
    <>
      {view === 'summary' && (
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.ink }]}>{pot.name}</Text>
          <Text style={[styles.sub, { color: colors.inkSoft }]}>
            {pot.members.find((m) => m.role === 'admin')?.name ?? 'Someone'} invited you to join this Pot.
          </Text>

          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Stat label="Members" value={String(pot.members.filter((m) => m.status === 'active').length)} colors={colors} />
            <Stat label="Contributed" value={formatMoney(calculateTotalContributions(txs))} colors={colors} />
            <Stat label="Spent" value={formatMoney(calculateTotalSpent(txs))} colors={colors} />
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
              <PrimaryButton label="Send Join Request" onPress={sendRequest} fullWidth disabled={!requestedName.trim()} />
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
          subtitle={`Your join request${pendingRequest ? ` for ${pot.name}` : ''} is waiting for admin approval.`}
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
  statValue: { fontSize: 17, fontWeight: '700' },
  statLabel: { fontSize: 11.5, marginTop: 3 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15, marginTop: 16 },
  helper: { fontSize: 12.5, lineHeight: 18, marginTop: 12 },
  actions: { paddingTop: 24 },
  spacer8: { height: 8 },
});
