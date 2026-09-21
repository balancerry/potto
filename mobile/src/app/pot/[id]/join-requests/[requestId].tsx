import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { explainBalance } from '@/logic/accounting';
import { suggestMemberMatches } from '@/logic/join-requests';
import { canReviewJoinRequests } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { AccessLevel } from '@/types/models';
import { formatMoney } from '@/utils/money';

type Mode = 'existing' | 'new';

export default function ReviewJoinRequestScreen() {
  const { id, requestId } = useLocalSearchParams<{ id: string; requestId: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, getJoinRequest, approveExistingMember, approveNewMember, rejectJoinRequest } =
    usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const me = getCurrentMember(id);
  const txs = getTransactions(id);
  const request = getJoinRequest(id, requestId);

  const unlinked = useMemo(
    () => (pot ? pot.members.filter((m) => m.status === 'active' && !m.userId) : []),
    [pot],
  );
  const ranked = useMemo(
    () => (request ? suggestMemberMatches(request.requestedName, unlinked) : []),
    [request, unlinked],
  );

  const [mode, setMode] = useState<Mode>(ranked[0] ? 'existing' : 'new');
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(ranked[0]?.id);
  const [displayName, setDisplayName] = useState(request?.requestedName ?? '');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('member');
  const [confirmLinkVisible, setConfirmLinkVisible] = useState(false);
  const [confirmRejectVisible, setConfirmRejectVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const selectedMember = unlinked.find((m) => m.id === selectedMemberId);

  useEffect(() => {
    if (mode === 'existing') {
      setDisplayName(request?.requestedName ?? '');
    }
  }, [mode, selectedMemberId, request?.requestedName]);

  const nameChips = useMemo(() => {
    const names = [request?.requestedName, selectedMember?.name].filter(
      (n): n is string => Boolean(n && n.trim()),
    );
    return [...new Set(names.map((n) => n.trim()))];
  }, [request?.requestedName, selectedMember?.name]);

  if (!pot) return null;

  if (!canReviewJoinRequests(me)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Join Request" onBack={() => router.back()} />
        <EmptyState icon="🔒" title="Admins only" subtitle="Only Pot admins can review join requests." />
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Join Request" onBack={() => router.back()} />
        <EmptyState icon="❓" title="Request not found" subtitle="This join request may have already been handled." />
      </SafeAreaView>
    );
  }

  if (request.status !== 'pending') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Join Request" onBack={() => router.back()} />
        <EmptyState
          icon={request.status === 'approved' ? '✅' : '🚫'}
          title={`Already ${request.status}`}
          subtitle={`${request.requestedName}'s request has already been ${request.status}.`}
        />
      </SafeAreaView>
    );
  }

  const history = selectedMember ? explainBalance(txs, selectedMember.id) : undefined;

  const doApproveExisting = async () => {
    if (!selectedMember || busy || !displayName.trim()) return;
    setBusy(true);
    setConfirmLinkVisible(false);
    try {
      const result = await approveExistingMember({
        potId: pot.id,
        joinRequestId: request.id,
        memberId: selectedMember.id,
        displayName: displayName.trim(),
        accessLevel,
      });
      if (!result.ok) {
        setErrorMessage(
          result.reason === 'member_already_linked'
            ? 'That member is already linked to a different account. Choose another member or create a new one.'
            : 'This request can no longer be approved — it may have already been reviewed.',
        );
        return;
      }
      showToast(`Linked as ${displayName.trim()}`);
      router.back();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not approve request');
    } finally {
      setBusy(false);
    }
  };

  const doApproveNew = async () => {
    if (!displayName.trim() || busy) return;
    setBusy(true);
    try {
      const result = await approveNewMember({
        potId: pot.id,
        joinRequestId: request.id,
        displayName: displayName.trim(),
        accessLevel,
      });
      if (!result.ok) {
        setErrorMessage('This request can no longer be approved — it may have already been reviewed.');
        return;
      }
      showToast(`${displayName.trim()} added to the Pot`);
      router.back();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not approve request');
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (busy) return;
    setBusy(true);
    setConfirmRejectVisible(false);
    try {
      const result = await rejectJoinRequest({ potId: pot.id, joinRequestId: request.id });
      if (!result.ok) {
        setErrorMessage('This request can no longer be rejected — it may have already been reviewed.');
        return;
      }
      showToast('Request rejected');
      router.back();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not reject request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Join Request" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.name, { color: colors.ink }]}>{request.requestedName}</Text>
        <Text style={[styles.sub, { color: colors.inkSoft }]}>Wants to join {pot.name}</Text>

        <View style={styles.modeRow}>
          <ModeTab
            label="Link to existing member"
            active={mode === 'existing'}
            onPress={() => setMode('existing')}
            disabled={unlinked.length === 0}
          />
          <ModeTab
            label="+ Create New Member"
            active={mode === 'new'}
            onPress={() => {
              setMode('new');
              setDisplayName(request.requestedName);
            }}
          />
        </View>

        {mode === 'existing' ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Existing members</Text>
            {unlinked.length === 0 ? (
              <Text style={[styles.sub, { color: colors.inkSoft }]}>No unlinked members — create a new one instead.</Text>
            ) : (
              <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                {ranked.map((m, i) => (
                  <RadioRow
                    key={m.id}
                    label={m.name}
                    checked={selectedMemberId === m.id}
                    highlight={i === 0 && ranked[0]?.name.toLowerCase().includes(request.requestedName.trim().toLowerCase().split(/\s+/)[0] ?? '')}
                    onPress={() => setSelectedMemberId(m.id)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.inkSoft }]}>Display name in this pot</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How this person should appear"
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
          />
          {nameChips.length > 0 ? (
            <View style={styles.chips}>
              {nameChips.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setDisplayName(name)}
                  style={[styles.chip, { borderColor: colors.line, backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: '600' }}>Use “{name}”</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={[styles.helper, { color: colors.inkSoft }]}>
            Choose the requester’s name, the existing member name, or type something else.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.inkSoft }]}>Access</Text>
          <RadioRow label="Member" checked={accessLevel === 'member'} onPress={() => setAccessLevel('member')} />
          <RadioRow label="View Only" checked={accessLevel === 'view_only'} onPress={() => setAccessLevel('view_only')} />
        </View>

        {!!errorMessage && <Text style={[styles.error, { color: colors.neg }]}>{errorMessage}</Text>}

        <View style={styles.actions}>
          <SecondaryButton label="Reject Request" onPress={() => setConfirmRejectVisible(true)} disabled={busy} fullWidth />
          <View style={styles.spacer8} />
          <PrimaryButton
            label={busy ? 'Working…' : 'Approve & Link'}
            onPress={() => (mode === 'existing' ? setConfirmLinkVisible(true) : void doApproveNew())}
            disabled={busy || !displayName.trim() || (mode === 'existing' && !selectedMember)}
            loading={busy}
            fullWidth
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmLinkVisible && !!selectedMember}
        title="Link account to existing member?"
        message={
          selectedMember && history
            ? `${request.requestedName} → ${selectedMember.name}\nShown as: ${displayName.trim()}\n\nExisting history:\n- Contributed ${formatMoney(history.contributed)}\n- Paid for group ${formatMoney(history.paidForGroup)}\n- Current balance ${formatMoney(history.net, { showSign: true })}\n\nThis account will inherit ${selectedMember.name}'s existing history and balance.`
            : ''
        }
        confirmLabel="Confirm & Approve"
        onConfirm={() => void doApproveExisting()}
        onCancel={() => setConfirmLinkVisible(false)}
      />

      <ConfirmDialog
        visible={confirmRejectVisible}
        title="Reject join request?"
        message={`${request.requestedName} will not get access to ${pot.name}.`}
        confirmLabel="Reject"
        destructive
        onConfirm={() => void doReject()}
        onCancel={() => setConfirmRejectVisible(false)}
      />
    </SafeAreaView>
  );
}

function ModeTab({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = usePottoColors();
  return (
    <Text
      onPress={disabled ? undefined : onPress}
      style={[
        styles.modeTab,
        {
          color: active ? '#fff' : colors.ink,
          backgroundColor: active ? colors.ink : colors.surface,
          borderColor: colors.line,
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      {label}
    </Text>
  );
}

function RadioRow({
  label,
  checked,
  highlight,
  onPress,
}: {
  label: string;
  checked: boolean;
  highlight?: boolean;
  onPress: () => void;
}) {
  const colors = usePottoColors();
  return (
    <Text onPress={onPress} style={[styles.radioRow, { borderBottomColor: colors.line }]}>
      <Text style={[styles.radioOuter, { color: checked ? colors.accent : colors.line }]}>{checked ? '●  ' : '○  '}</Text>
      <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: checked ? '700' : '500' }}>{label}</Text>
      {highlight && <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{'  (possible match)'}</Text>}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  name: { fontSize: 19, fontWeight: '700' },
  sub: { fontSize: 13.5, marginTop: 3, marginBottom: 4 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 20 },
  modeTab: { flex: 1, textAlign: 'center', paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1, fontSize: 13, fontWeight: '700' },
  field: { marginBottom: 20 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  helper: { fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  list: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  radioRow: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  radioOuter: { fontSize: 14 },
  error: { fontSize: 12.5, marginBottom: 12, fontWeight: '600' },
  actions: { paddingTop: 8 },
  spacer8: { height: 10 },
});
