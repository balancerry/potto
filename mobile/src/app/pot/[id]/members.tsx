import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { MemberRow } from '@/components/potto/MemberRow';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { calculateMemberBalances, calculateMemberContributed } from '@/logic/accounting';
import { canManageMembers } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { AccessLevel, Member, MemberRole } from '@/types/models';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, getJoinRequests, removeMember, updateMember } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const txs = getTransactions(id);
  const me = getCurrentMember(id);
  const [editing, setEditing] = useState<Member | null>(null);

  if (!pot) return null;

  const isAdmin = canManageMembers(me);
  const active = pot.members.filter((m) => m.status === 'active');
  const inactive = pot.members.filter((m) => m.status === 'inactive');
  const pendingRequests = isAdmin ? getJoinRequests(id).filter((r) => r.status === 'pending') : [];
  const balances = calculateMemberBalances(pot.members, txs);

  const handleRemove = async (member: Member) => {
    try {
      const result = await removeMember(id, member.id);
      if (!result.ok) {
        showToast(result.reason === 'cannot_remove_self' ? 'You cannot remove yourself' : 'Could not remove member');
        return;
      }
      showToast(`${member.name} removed from the Pot`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not remove member');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title={`${active.length} Members`} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {pendingRequests.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>PENDING</Text>
            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Text style={[styles.pendingCount, { color: colors.ink }]}>
                {pendingRequests.length} Join Request{pendingRequests.length !== 1 ? 's' : ''}
              </Text>
              {pendingRequests.map((r, i) => (
                <View
                  key={r.id}
                  style={[styles.pendingRow, i < pendingRequests.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                  <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                    {r.requestedName}
                  </Text>
                  <Pressable
                    onPress={() => router.push(`/pot/${id}/join-requests/${r.id}`)}
                    style={[styles.reviewBtn, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Review</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>ACTIVE</Text>
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {active.map((m) => (
            <MemberRowWithMenu
              key={m.id}
              member={m}
              balance={balances[m.id] ?? 0}
              contributed={calculateMemberContributed(txs, m.id)}
              isAdmin={isAdmin}
              onPress={() => router.push(`/pot/${id}/balance?memberId=${m.id}`)}
              onEdit={() => setEditing(m)}
              onRemove={() => void handleRemove(m)}
            />
          ))}
        </View>

        {isAdmin && inactive.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>REMOVED</Text>
            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {inactive.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  balance={balances[m.id] ?? 0}
                  contributed={calculateMemberContributed(txs, m.id)}
                  onPress={() => router.push(`/pot/${id}/balance?memberId=${m.id}`)}
                />
              ))}
            </View>
            <Text style={[styles.hint, { color: colors.inkSoft }]}>
              Removed members keep their financial history. They can rejoin and be re-linked to it later.
            </Text>
          </>
        )}

        <Text style={[styles.hint, { color: colors.inkSoft }]}>Tap a member to view their balance breakdown from the ledger.</Text>
      </ScrollView>

      {editing ? (
        <EditMemberModal
          member={editing}
          onClose={() => setEditing(null)}
          onSave={async (updates) => {
            try {
              const result = await updateMember({
                potId: id,
                memberId: editing.id,
                ...updates,
              });
              if (!result.ok) {
                showToast(
                  result.reason === 'last_admin'
                    ? 'This pot needs at least one admin'
                    : 'Could not update member',
                );
                return;
              }
              showToast('Member updated');
              setEditing(null);
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Could not update member');
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function MemberRowWithMenu({
  member,
  balance,
  contributed,
  isAdmin,
  onPress,
  onEdit,
  onRemove,
}: {
  member: Member;
  balance: number;
  contributed: number;
  isAdmin: boolean;
  onPress: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  if (!isAdmin) {
    return <MemberRow member={member} balance={balance} contributed={contributed} onPress={onPress} />;
  }
  const items = [
    { label: 'Edit role & access', onPress: onEdit },
    ...(member.role !== 'admin' ? [{ label: 'Remove Member', onPress: onRemove, destructive: true as const }] : []),
  ];
  return (
    <View style={styles.rowWithMenu}>
      <View style={styles.grow}>
        <MemberRow member={member} balance={balance} contributed={contributed} onPress={onPress} />
      </View>
      <View style={styles.menuAnchor}>
        <ActionMenu items={items} />
      </View>
    </View>
  );
}

function EditMemberModal({
  member,
  onClose,
  onSave,
}: {
  member: Member;
  onClose: () => void;
  onSave: (updates: { displayName: string; role: MemberRole; accessLevel: AccessLevel }) => Promise<void>;
}) {
  const colors = usePottoColors();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<MemberRole>(member.role);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(member.accessLevel);
  const [saving, setSaving] = useState(false);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.line }]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.modalTitle, { color: colors.ink }]}>Edit member</Text>

          <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>Display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
          />

          <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>Role</Text>
          <View style={styles.optionRow}>
            {(['member', 'admin'] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  setRole(r);
                  if (r === 'admin') setAccessLevel('member');
                }}
                style={[
                  styles.option,
                  {
                    borderColor: colors.line,
                    backgroundColor: role === r ? colors.ink : colors.surfaceSunk,
                  },
                ]}>
                <Text style={{ color: role === r ? '#fff' : colors.ink, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' }}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>Access</Text>
          <View style={styles.optionRow}>
            {(
              [
                { value: 'member' as const, label: 'Full member' },
                { value: 'view_only' as const, label: 'View only' },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.value}
                disabled={role === 'admin'}
                onPress={() => setAccessLevel(opt.value)}
                style={[
                  styles.option,
                  {
                    borderColor: colors.line,
                    backgroundColor: (role === 'admin' ? 'member' : accessLevel) === opt.value ? colors.ink : colors.surfaceSunk,
                    opacity: role === 'admin' ? 0.55 : 1,
                  },
                ]}>
                <Text
                  style={{
                    color: (role === 'admin' ? 'member' : accessLevel) === opt.value ? '#fff' : colors.ink,
                    fontWeight: '700',
                    fontSize: 13,
                  }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {role === 'admin' ? (
            <Text style={[styles.helper, { color: colors.inkSoft }]}>Admins always have full member access.</Text>
          ) : null}

          <View style={{ height: 16 }} />
          <PrimaryButton
            label={saving ? 'Saving…' : 'Save'}
            loading={saving}
            disabled={saving || !name.trim()}
            fullWidth
            onPress={async () => {
              setSaving(true);
              try {
                await onSave({
                  displayName: name.trim(),
                  role,
                  accessLevel: role === 'admin' ? 'member' : accessLevel,
                });
              } finally {
                setSaving(false);
              }
            }}
          />
          <View style={{ height: 8 }} />
          <SecondaryButton label="Cancel" onPress={onClose} disabled={saving} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 32, paddingTop: 8 },
  list: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  pendingCount: { fontSize: 13, fontWeight: '700', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16 },
  reviewBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 14 },
  rowWithMenu: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  menuAnchor: { paddingRight: 14 },
  hint: { fontSize: 12.5, paddingHorizontal: 20, paddingTop: 14, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,18,14,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: Radius.lg, borderWidth: 1, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  optionRow: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  helper: { fontSize: 12, marginTop: 8, lineHeight: 17 },
});
