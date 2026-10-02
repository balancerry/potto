import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { Button } from '@/components/potto/Button';
import { PotSectionNav } from '@/components/potto/PotSectionNav';
import { TransactionRow } from '@/components/potto/TransactionRow';
import { PottoFonts, Radius, usePottoColors } from '@/constants/potto-theme';
import { recordPotVisit } from '@/lib/user-pot-prefs';
import {
  calculatePoolBalance,
  calculateTotalContributions,
  calculateTotalSpent,
  sortTransactionsRecentFirst,
} from '@/logic/accounting';
import { calculateTotalUpcomingRemaining } from '@/logic/commitments';
import { getPotNextAction, type NextActionTarget } from '@/logic/next-up';
import { calculateAccountBalance } from '@/logic/pool-money';
import { canAddExpense, canAddMoney, canCreateCommitment, canInvite, canManagePoolMoney } from '@/logic/permissions';
import { useAuth } from '@/store/AuthContext';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import { formatMoney } from '@/utils/money';

const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;

export default function PotDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { showToast } = useToast();
  const { user } = useAuth();
  const {
    getPot,
    getTransactions,
    getCurrentMember,
    getCommitments,
    getCommitmentPayments,
    getPoolAccounts,
    getPoolManagerMemberId,
    reloadWorkspace,
  } = usePottoStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id && id) void recordPotVisit(user.id, id);
  }, [user?.id, id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }, [reloadWorkspace, showToast]);

  const pot = getPot(id);
  const txs = getTransactions(id);

  if (!pot || !id) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScrollView
          contentContainerStyle={styles.missing}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to your pots" onPress={() => router.replace('/')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.inkSoft, fontSize: 15, fontWeight: '600' }}>← Your pots</Text>
          </Pressable>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 12 }}>Pot not found</Text>
          <Text style={{ color: colors.inkSoft, marginTop: 6 }}>This pot may have been removed. Pull down to refresh.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const me = getCurrentMember(id);
  const commitments = getCommitments(id);
  const commitmentPayments = commitments.flatMap((c) => getCommitmentPayments(id, c.id));
  const pool = calculatePoolBalance(txs);
  const contributed = calculateTotalContributions(txs);
  const spent = calculateTotalSpent(txs);
  const upcoming = calculateTotalUpcomingRemaining(commitments, commitmentPayments, txs);
  const next = getPotNextAction({
    members: pot.members,
    transactions: txs,
    commitments,
    commitmentPayments,
    expectedContributionPerMember: pot.expectedContributionPerMember,
  });
  const recent = sortTransactionsRecentFirst(txs).slice(0, 4);
  const managerId = getPoolManagerMemberId(id);
  const manager = pot.members.find((m) => m.id === managerId);
  const accounts = getPoolAccounts(id).filter((a) => a.active);
  const people = pot.members.filter((m) => m.status === 'active').length;
  const context = manager ? `${people} ${people === 1 ? 'person' : 'people'} · Pool managed by ${manager.name}` : `${people} ${people === 1 ? 'person' : 'people'}`;
  const memberName = (memberId?: string) => pot.members.find((m) => m.id === memberId)?.name ?? '—';
  const accountName = (accountId?: string) => accounts.find((a) => a.id === accountId)?.name ?? 'Pool';

  const openTarget = (target: NextActionTarget, commitmentId?: string) => {
    if (target === 'add_contribution') router.push(`/pot/${id}/add-money`);
    else if (target === 'invite') router.push(`/pot/${id}/invite`);
    else if (target === 'view_contributions') router.push(`/pot/${id}/transactions?type=contribution`);
    else if (target === 'record_payment') router.push(commitmentId ? `/pot/${id}/commitment/${commitmentId}` : `/pot/${id}/commitments`);
    else if (target === 'settle') router.push(`/pot/${id}/settle`);
    else router.push(`/pot/${id}/summary`);
  };
  const canFollowNext = (target: NextActionTarget) =>
    target === 'invite' ? canInvite(me) : target === 'add_contribution' ? canAddMoney(me, managerId) : true;

  const showExpense = canAddExpense(me, managerId);
  const showUpcoming = canCreateCommitment(me);
  const showTransfer = canManagePoolMoney(me, managerId) && pool > 0;

  const menuItems = [
    { label: 'Planned payments', onPress: () => router.push(`/pot/${id}/commitments`) },
    { label: 'Invite people', onPress: () => router.push(`/pot/${id}/invite`) },
    { label: 'Share pot', onPress: () => router.push(`/pot/${id}/share`) },
    { label: 'Summary', onPress: () => router.push(`/pot/${id}/summary`) },
    { label: 'Pool management', onPress: () => router.push(`/pot/${id}/pool`) },
    { label: 'Pot settings', onPress: () => router.push(`/pot/${id}/settings`) },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />}>
        <View style={styles.topbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to your pots"
            onPress={() => router.replace('/')}
            style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.inkSoft, fontSize: 15, fontWeight: '600' }}>← Your pots</Text>
          </Pressable>
          <View style={styles.spacer} />
          <ActionMenu items={menuItems} />
        </View>

        <View style={styles.identity}>
          <Text style={[styles.title, { color: colors.ink, fontFamily: displayFont }]}>{pot.name}</Text>
          <Text style={[styles.context, { color: colors.inkSoft }]}>{context}</Text>
        </View>
        <PotSectionNav potId={id} current="overview" />

        <View style={[styles.nextCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.kicker, { color: colors.inkSoft }]}>NEXT UP</Text>
          <Text style={[styles.nextTitle, { color: colors.ink, fontFamily: displayFont }]}>
            {next.type === 'complete' ? '✓ ' : ''}
            {next.title}
          </Text>
          <Text style={[styles.nextBody, { color: colors.inkSoft }]}>{next.description}</Text>
          {next.amountPaise != null ? (
            <Text style={[styles.nextAmount, { color: colors.ink }]}>
              {formatMoney(next.amountPaise)} <Text style={{ color: colors.inkSoft, fontSize: 15 }}>{next.amountLabel}</Text>
            </Text>
          ) : null}
          {next.supporting ? <Text style={[styles.nextBody, { color: colors.ink }]}>{next.supporting}</Text> : null}
          {next.type !== 'complete' && canFollowNext(next.target) ? (
            <View style={styles.primaryWrap}>
              <Button label={next.primaryLabel} onPress={() => openTarget(next.target, next.commitmentId)} variant="accent" fullWidth />
            </View>
          ) : null}
          {next.secondaryLabel && next.secondaryTarget && canFollowNext(next.secondaryTarget) ? (
            <View style={styles.secondaryWrap}>
              <Button
                label={next.secondaryLabel}
                onPress={() => openTarget(next.secondaryTarget!, next.commitmentId)}
                variant="secondary"
                fullWidth
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.kicker, { color: colors.inkSoft }]}>POOL</Text>
          <Text style={[styles.poolAmount, { color: colors.accent }]}>{formatMoney(pool)}</Text>
          <View style={styles.stats}>
            <Stat label="Collected" value={formatMoney(contributed)} />
            <Stat label="Spent" value={formatMoney(spent)} />
            <Stat label="Planned" value={formatMoney(upcoming)} />
          </View>
          {accounts.length > 0 ? (
            <Text style={[styles.accounts, { color: colors.inkSoft }]}>
              {accounts
                .map((account) => `${account.type === 'cash' ? 'Cash' : 'Bank'} ${formatMoney(calculateAccountBalance(txs, account.id))}`)
                .join(' · ')}
            </Text>
          ) : null}
        </View>

        {pot.status === 'active' && (showExpense || showUpcoming || showTransfer) ? (
          <View style={styles.section}>
            <Text style={[styles.kicker, { color: colors.inkSoft }]}>QUICK ACTIONS</Text>
            {showExpense ? (
              <View style={styles.secondaryWrap}>
                <Button label="Add expense" onPress={() => router.push(`/pot/${id}/add-expense`)} variant="secondary" fullWidth />
              </View>
            ) : null}
            {showUpcoming ? (
              <View style={styles.secondaryWrap}>
                <Button label="Add planned payment" onPress={() => router.push(`/pot/${id}/add-commitment`)} variant="secondary" fullWidth />
              </View>
            ) : null}
            {showTransfer ? (
              <View style={styles.secondaryWrap}>
                <Button label="Transfer money" onPress={() => router.push(`/pot/${id}/transfer`)} variant="secondary" fullWidth />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={[styles.kicker, { color: colors.inkSoft }]}>RECENT ACTIVITY</Text>
          {recent.length > 0 ? (
            <Pressable accessibilityRole="link" onPress={() => router.push(`/pot/${id}/transactions`)}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>View all</Text>
            </Pressable>
          ) : null}
        </View>
        {recent.length === 0 ? (
          <View style={styles.section}>
            <Text style={[styles.nextTitle, { color: colors.ink, fontSize: 18 }]}>Start your pot</Text>
            <Text style={[styles.nextBody, { color: colors.inkSoft }]}>
              Once money starts flowing, you'll see contributions, spending, planned payments, and the current pool balance here.
            </Text>
          </View>
        ) : (
          <View style={[styles.txList, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {recent.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                memberName={memberName}
                accountName={accountName}
                onPress={() => router.push(`/pot/${id}/transaction/${t.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = usePottoColors();
  return (
    <View style={styles.stat}>
      <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  missing: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4 },
  spacer: { flex: 1 },
  identity: { paddingHorizontal: 20, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: '600' },
  context: { fontSize: 14, marginTop: 4 },
  nextCard: { marginHorizontal: 20, marginTop: 18, borderWidth: 1, borderRadius: Radius.lg, padding: 16 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  nextTitle: { fontSize: 22, fontWeight: '600', marginTop: 6 },
  nextBody: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  nextAmount: { fontSize: 22, fontWeight: '600', marginTop: 10 },
  primaryWrap: { marginTop: 14 },
  section: { paddingHorizontal: 20, paddingTop: 22 },
  poolAmount: { fontSize: 36, fontWeight: '600', marginTop: 4 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 14 },
  stat: { flex: 1 },
  accounts: { fontSize: 14, marginTop: 12 },
  secondaryWrap: { marginTop: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22 },
  txList: { marginHorizontal: 20, marginTop: 8, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
});
