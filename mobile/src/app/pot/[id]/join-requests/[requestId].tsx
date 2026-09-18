import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

  const [mode, setMode] = useState<Mode>('existing');
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>();
  const [displayName, setDisplayName] = useState(request?.requestedName ?? '');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('member');
  const [confirmLinkVisible, setConfirmLinkVisible] = useState(false);
  const [confirmRejectVisible, setConfirmRejectVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const suggestions = useMemo(
    () => (pot && request ? suggestMemberMatches(request.requestedName, pot.members) : []),
    [pot, request],
  );

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

  const selectedMember = suggestions.find((m) => m.id === selectedMemberId);
  const history = selectedMember ? explainBalance(txs, selectedMember.id) : undefined;

  const doApproveExisting = () => {
    if (!selectedMember) return;
    const result = approveExistingMember({ potId: pot.id, joinRequestId: request.id, memberId: selectedMember.id, accessLevel });
    setConfirmLinkVisible(false);
    if (!result.ok) {
      setErrorMessage(
        result.reason === 'member_already_linked'
          ? 'That member is already linked to a different account. Choose another member or create a new one.'
          : 'This request can no longer be approved — it may have already been reviewed.',
      );
      return;
    }
    showToast(`Linked to ${selectedMember.name}`);
    router.back();
  };

  const doApproveNew = () => {
    if (!displayName.trim()) return;
    const result = approveNewMember({ potId: pot.id, joinRequestId: request.id, displayName, accessLevel });
    if (!result.ok) {
      setErrorMessage('This request can no longer be approved — it may have already been reviewed.');
      return;
    }
    showToast(`${displayName.trim()} added to the Pot`);
    router.back();
  };

  const doReject = () => {
    const result = rejectJoinRequest({ potId: pot.id, joinRequestId: request.id });
    setConfirmRejectVisible(false);
    if (!result.ok) {
      setErrorMessage('This request can no longer be rejected — it may have already been reviewed.');
      return;
    }
    showToast('Request rejected');
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Join Request" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.name, { color: colors.ink }]}>{request.requestedName}</Text>
        <Text style={[styles.sub, { color: colors.inkSoft }]}>Wants to join {pot.name}</Text>

        <View style={styles.modeRow}>
          <ModeTab label="Link to existing member" active={mode === 'existing'} onPress={() => setMode('existing')} />
          <ModeTab label="+ Create New Member" active={mode === 'new'} onPress={() => setMode('new')} />
        </View>

        {mode === 'existing' ? (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Existing members</Text>
            {suggestions.length === 0 ? (
              <Text style={[styles.sub, { color: colors.inkSoft }]}>No active members yet — create a new one instead.</Text>
            ) : (
              <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                {suggestions.map((m, i) => (
                  <RadioRow
                    key={m.id}
                    label={m.name}
                    checked={selectedMemberId === m.id}
                    highlight={i === 0}
                    onPress={() => setSelectedMemberId(m.id)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Display name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Rajkumar Jangid"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.inkSoft }]}>Access</Text>
          <RadioRow label="Member" checked={accessLevel === 'member'} onPress={() => setAccessLevel('member')} />
          <RadioRow label="View Only" checked={accessLevel === 'view_only'} onPress={() => setAccessLevel('view_only')} />
        </View>

        {!!errorMessage && <Text style={[styles.error, { color: colors.neg }]}>{errorMessage}</Text>}

        <View style={styles.actions}>
          <SecondaryButton label="Reject Request" onPress={() => setConfirmRejectVisible(true)} fullWidth />
          <View style={styles.spacer8} />
          <PrimaryButton
            label="Approve & Link"
            onPress={() => (mode === 'existing' ? setConfirmLinkVisible(true) : doApproveNew())}
            disabled={mode === 'existing' ? !selectedMember : !displayName.trim()}
            fullWidth
          />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmLinkVisible && !!selectedMember}
        title="Link account to existing member?"
        message={
          selectedMember && history
            ? `${request.requestedName} → ${selectedMember.name}\n\nExisting history:\n- Contributed ${formatMoney(history.contributed)}\n- Paid for group ${formatMoney(history.paidForGroup)}\n- Current balance ${formatMoney(history.net, { showSign: true })}\n\nThis account will inherit ${selectedMember.name}'s existing history and balance. No transactions will move or be recalculated.`
            : ''
        }
        confirmLabel="Confirm & Approve"
        onConfirm={doApproveExisting}
        onCancel={() => setConfirmLinkVisible(false)}
      />

      <ConfirmDialog
        visible={confirmRejectVisible}
        title="Reject join request?"
        message={`${request.requestedName} will not get access to ${pot.name}.`}
        confirmLabel="Reject"
        destructive
        onConfirm={doReject}
        onCancel={() => setConfirmRejectVisible(false)}
      />
    </SafeAreaView>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = usePottoColors();
  return (
    <Text
      onPress={onPress}
      style={[
        styles.modeTab,
        {
          color: active ? '#fff' : colors.ink,
          backgroundColor: active ? colors.ink : colors.surface,
          borderColor: colors.line,
        },
      ]}>
      {label}
    </Text>
  );
}

function RadioRow({ label, checked, highlight, onPress }: { label: string; checked: boolean; highlight?: boolean; onPress: () => void }) {
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
  list: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  radioRow: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  radioOuter: { fontSize: 14 },
  error: { fontSize: 12.5, marginBottom: 12, fontWeight: '600' },
  actions: { paddingTop: 8 },
  spacer8: { height: 10 },
});
