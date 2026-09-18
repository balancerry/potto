import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { MemberRow } from '@/components/potto/MemberRow';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { calculateMemberBalances, calculateMemberContributed } from '@/logic/accounting';
import { canManageMembers } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { Member } from '@/types/models';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, getJoinRequests, removeMember } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const txs = getTransactions(id);
  const me = getCurrentMember(id);

  if (!pot) return null;

  const isAdmin = canManageMembers(me);
  const active = pot.members.filter((m) => m.status === 'active');
  const inactive = pot.members.filter((m) => m.status === 'inactive');
  const pendingRequests = isAdmin ? getJoinRequests(id).filter((r) => r.status === 'pending') : [];
  const balances = calculateMemberBalances(pot.members, txs);

  const handleRemove = (member: Member) => {
    const result = removeMember(id, member.id);
    if (result.ok) showToast(`${member.name} removed from the Pot`);
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
              canRemove={isAdmin && m.role !== 'admin'}
              onPress={() => router.push(`/pot/${id}/balance?memberId=${m.id}`)}
              onRemove={() => handleRemove(m)}
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
    </SafeAreaView>
  );
}

function MemberRowWithMenu({
  member,
  balance,
  contributed,
  canRemove,
  onPress,
  onRemove,
}: {
  member: Member;
  balance: number;
  contributed: number;
  canRemove: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  if (!canRemove) {
    return <MemberRow member={member} balance={balance} contributed={contributed} onPress={onPress} />;
  }
  return (
    <View style={styles.rowWithMenu}>
      <View style={styles.grow}>
        <MemberRow member={member} balance={balance} contributed={contributed} onPress={onPress} />
      </View>
      <View style={styles.menuAnchor}>
        <ActionMenu items={[{ label: 'Remove Member', onPress: onRemove, destructive: true }]} />
      </View>
    </View>
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
});
