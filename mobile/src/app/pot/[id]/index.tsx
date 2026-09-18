import { router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { Button } from '@/components/potto/Button';
import { commitmentIcon } from '@/components/potto/CommitmentCard';
import { EmptyState } from '@/components/potto/EmptyState';
import { TransactionRow } from '@/components/potto/TransactionRow';
import { PottoFonts, Radius, usePottoColors } from '@/constants/potto-theme';
import {
  calculatePoolBalance,
  calculateTotalContributions,
  calculateTotalSpent,
  sortTransactionsRecentFirst,
} from '@/logic/accounting';
import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  calculatePotentialShortfall,
  calculateTotalUpcomingRemaining,
  deriveCommitmentStatus,
} from '@/logic/commitments';
import { canAddExpense, canAddMoney, canManageMembers } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { formatDate, formatMoney } from '@/utils/money';

const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;

export default function PotDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, getJoinRequests, getCommitments, getCommitmentPayments } =
    usePottoStore();

  const pot = getPot(id);
  const txs = getTransactions(id);

  if (!pot) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <EmptyState icon="❓" title="Pot not found" subtitle="This pot may have been removed." />
      </SafeAreaView>
    );
  }

  const me = getCurrentMember(id);
  const pool = calculatePoolBalance(txs);
  const contributed = calculateTotalContributions(txs);
  const spent = calculateTotalSpent(txs);
  const recent = sortTransactionsRecentFirst(txs).slice(0, 8);
  const isAdmin = canManageMembers(me);
  const pendingCount = isAdmin ? getJoinRequests(id).filter((r) => r.status === 'pending').length : 0;

  const commitments = getCommitments(id);
  const commitmentPayments = commitments.flatMap((c) => getCommitmentPayments(id, c.id));
  const activeCommitments = commitments
    .filter((c) => {
      const s = deriveCommitmentStatus(c, calculateCommitmentPaid(c.id, commitmentPayments, txs));
      return s === 'planned' || s === 'partially_paid';
    })
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const upcomingTotal = calculateTotalUpcomingRemaining(commitments, commitmentPayments, txs);
  const shortfall = calculatePotentialShortfall(pool, upcomingTotal);

  const memberName = (memberId?: string) => pot.members.find((m) => m.id === memberId)?.name ?? '—';

  const menuItems = [
    { label: 'Pot Summary', onPress: () => router.push(`/pot/${id}/summary`) },
    ...(isAdmin ? [{ label: 'Pot Settings', onPress: () => router.push(`/pot/${id}/settings`) }] : []),
    { label: 'Manage Members', onPress: () => router.push(`/pot/${id}/members`) },
    ...(isAdmin
      ? [
          {
            label: pendingCount > 0 ? `Join Requests (${pendingCount})` : 'Join Requests',
            onPress: () => router.push(`/pot/${id}/members`),
          },
        ]
      : []),
    { label: 'Invite Members', onPress: () => router.push(`/pot/${id}/invite`) },
    ...(isAdmin ? [{ label: 'Archive Pot', onPress: () => router.push(`/pot/${id}/settings`), destructive: true }] : []),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} style={[styles.iconBtn, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.ink, fontSize: 18 }}>{'←'}</Text>
          </Pressable>
          <View style={styles.spacer} />
          <ActionMenu items={menuItems} />
        </View>

        <View style={[styles.hero, { backgroundColor: colors.ink }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.heroTitle, { color: colors.paper, fontFamily: displayFont }]}>{pot.name}</Text>
              <Text style={[styles.heroSub, { color: colors.paper }]}>{pot.members.length} members</Text>
            </View>
          </View>
          <Text style={[styles.poolLabel, { color: colors.paper }]}>POOL BALANCE</Text>
          <Text style={[styles.poolAmount, { color: colors.paper, fontFamily: displayFont }]}>{formatMoney(pool)}</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLbl, { color: colors.paper }]}>Contributed</Text>
              <Text style={[styles.heroStatVal, { color: '#8FE0BB', fontFamily: displayFont }]}>{formatMoney(contributed)}</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatLbl, { color: colors.paper }]}>Spent</Text>
              <Text style={[styles.heroStatVal, { color: '#F0A587', fontFamily: displayFont }]}>{formatMoney(spent)}</Text>
            </View>
          </View>
        </View>

        {(canAddMoney(me) || canAddExpense(me)) && (
          <View style={styles.quickActions}>
            {canAddMoney(me) && (
              <View style={styles.flex1}>
                <Button label="+ Add Money" onPress={() => router.push(`/pot/${id}/add-money`)} variant="accent" fullWidth />
              </View>
            )}
            {canAddExpense(me) && (
              <View style={styles.flex1}>
                <Button label="+ Add Expense" onPress={() => router.push(`/pot/${id}/add-expense`)} variant="secondary" fullWidth />
              </View>
            )}
          </View>
        )}

        <View style={styles.navRow}>
          <NavPill label="Transactions" onPress={() => router.push(`/pot/${id}/transactions`)} />
          <NavPill label="Members" onPress={() => router.push(`/pot/${id}/members`)} />
          <NavPill label="Settle Up" onPress={() => router.push(`/pot/${id}/settle`)} />
          <NavPill label="Upcoming Payments" onPress={() => router.push(`/pot/${id}/commitments`)} />
          <NavPill label="Invite" onPress={() => router.push(`/pot/${id}/invite`)} />
        </View>

        {commitments.length > 0 && (
          <>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>UPCOMING PAYMENTS</Text>
              <Pressable onPress={() => router.push(`/pot/${id}/commitments`)}>
                <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>View all</Text>
              </Pressable>
            </View>
            <View style={[styles.upcomingCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Text style={[styles.upcomingTotal, { color: colors.ink }]}>{formatMoney(upcomingTotal)}</Text>
              <Text style={[styles.upcomingSub, { color: colors.inkSoft }]}>not included in Total Spent</Text>
              {activeCommitments.slice(0, 3).map((c) => {
                const remaining = calculateCommitmentRemaining(c, commitmentPayments, txs);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/pot/${id}/commitment/${c.id}`)}
                    style={[styles.upcomingRow, { borderTopColor: colors.line }]}>
                    <Text style={{ fontSize: 16 }}>{commitmentIcon(c.category)}</Text>
                    <Text style={[styles.upcomingName, { color: colors.ink }]} numberOfLines={1}>
                      {c.vendorName || c.title}
                    </Text>
                    <View style={styles.flex1} />
                    <Text style={{ color: colors.neg, fontSize: 13.5, fontWeight: '600' }}>{formatMoney(remaining)}</Text>
                    {!!c.dueDate && (
                      <Text style={{ color: colors.inkSoft, fontSize: 12, marginLeft: 8 }}>Due {formatDate(c.dueDate)}</Text>
                    )}
                  </Pressable>
                );
              })}
              {shortfall > 0 && (
                <View style={[styles.shortfallNote, { backgroundColor: colors.goldSoft }]}>
                  <Text style={{ color: colors.gold, fontSize: 12, lineHeight: 17 }}>
                    Upcoming commitments exceed current pool balance by {formatMoney(shortfall)}. You may need additional contributions.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.sectionHeadRow}>
          <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>RECENT ACTIVITY</Text>
          {txs.length > 0 && (
            <Pressable onPress={() => router.push(`/pot/${id}/transactions`)}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>See all</Text>
            </Pressable>
          )}
        </View>

        {recent.length === 0 ? (
          <EmptyState icon="🪨" title="No activity yet" subtitle="Add money or record an expense to get started." />
        ) : (
          <View style={[styles.txList, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {recent.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                memberName={memberName}
                onPress={() => router.push(`/pot/${id}/transaction/${t.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NavPill({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = usePottoColors();
  return (
    <Pressable onPress={onPress} style={[styles.navPill, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 32 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  spacer: { flex: 1 },
  hero: { margin: 20, marginTop: 10, padding: 22, borderRadius: 24 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '600' },
  heroSub: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  poolLabel: { fontSize: 12, opacity: 0.7, marginTop: 20, letterSpacing: 0.5 },
  poolAmount: { fontSize: 40, fontWeight: '600', marginTop: 2 },
  heroStatsRow: { flexDirection: 'row', gap: 24, marginTop: 18 },
  heroStat: {},
  heroStatLbl: { fontSize: 11.5, opacity: 0.65 },
  heroStatVal: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  quickActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 20 },
  navPill: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1 },
  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6 },
  txList: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  flex1: { flex: 1 },
  upcomingCard: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, padding: 16 },
  upcomingTotal: { fontSize: 24, fontWeight: '700' },
  upcomingSub: { fontSize: 12, marginTop: 2 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginTop: 8, borderTopWidth: 1 },
  upcomingName: { fontSize: 13.5, fontWeight: '600', flexShrink: 1 },
  shortfallNote: { borderRadius: Radius.md, padding: 10, marginTop: 12 },
});
