import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/potto/EmptyState';
import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { RecordPaymentModal } from '@/components/potto/RecordPaymentModal';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { SettlementCard } from '@/components/potto/SettlementCard';
import { paymentMethodLabel } from '@/constants/payment-methods';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import {
  calculateMemberSettlementTransfers,
  calculateMyPosition,
  calculatePoolFundingPlan,
  explainBalance,
  sortTransactionsRecentFirst,
} from '@/logic/accounting';
import { canAddMoney, canSettle } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { PaymentMethod, SettlementTransfer } from '@/types/models';
import { formatDate, formatMoney, toRupees } from '@/utils/money';

export default function SettleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, recordSettlement } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const txs = getTransactions(id);
  const me = getCurrentMember(id);
  const [activeTransfer, setActiveTransfer] = useState<SettlementTransfer | null>(null);
  const [paymentNonce, setPaymentNonce] = useState(0);
  const [showCalculation, setShowCalculation] = useState(false);

  const plan = useMemo(() => (pot ? calculatePoolFundingPlan(pot.members, txs) : null), [pot, txs]);
  const memberTransfers = useMemo(() => (pot ? calculateMemberSettlementTransfers(pot.members, txs) : []), [pot, txs]);
  const myPosition = useMemo(
    () => (pot && me ? calculateMyPosition(pot.members, txs, me.id) : null),
    [pot, txs, me],
  );
  const myExplain = useMemo(() => (me ? explainBalance(txs, me.id) : null), [txs, me]);

  const history = useMemo(
    () => sortTransactionsRecentFirst(txs).filter((t) => t.type === 'settlement'),
    [txs],
  );

  if (!pot || !plan) return null;

  const memberName = (mid: string) => pot.members.find((m) => m.id === mid)?.name ?? '—';
  const canAdd = canAddMoney(me);
  const canRecordPayment = canSettle(me);
  const poolBalanced = plan.amountNeeded === 0;
  const allSettled = poolBalanced && memberTransfers.length === 0;

  const openTransfer = (t: SettlementTransfer) => {
    if (!canRecordPayment) return;
    setActiveTransfer(t);
    setPaymentNonce((n) => n + 1);
  };
  const closeModal = () => setActiveTransfer(null);

  const confirmPayment = (paidPaise: number, paymentMethod: PaymentMethod | undefined, note: string | undefined) => {
    if (!activeTransfer) return;
    recordSettlement({
      potId: id,
      fromMemberId: activeTransfer.from,
      toMemberId: activeTransfer.to,
      amount: paidPaise,
      paymentMethod,
      note,
    });
    showToast(paidPaise >= activeTransfer.amount ? 'Settlement completed' : 'Partial payment recorded');
    setActiveTransfer(null);
  };

  const goAddToPool = (amountPaise: number) => {
    if (!me) return;
    router.push({
      pathname: '/pot/[id]/add-money',
      params: { id, amount: String(toRupees(amountPaise)), memberId: me.id },
    });
  };

  const fundingPct = plan.target > 0 ? Math.round((plan.funded / plan.target) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Settle Up" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {allSettled ? (
          <View style={styles.hero}>
            <Text style={[styles.heroTitle, { color: colors.ink }]}>{'✓ All settled'}</Text>
            <Text style={[styles.heroSub, { color: colors.inkSoft }]}>Everyone is balanced. No payments remaining.</Text>
            <View style={[styles.totalSpendPill, { backgroundColor: colors.surfaceSunk }]}>
              <Text style={{ color: colors.inkSoft, fontSize: 12.5 }}>Pool balance</Text>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 2 }}>
                {formatMoney(plan.poolBalance)}
              </Text>
            </View>
          </View>
        ) : (
          myPosition && (
            <View style={styles.hero}>
              <Text style={[styles.heroLabel, { color: colors.inkSoft }]}>YOUR POSITION</Text>

              {myPosition.kind === 'receive' && (
                <>
                  <Text style={[styles.heroAmt, { color: colors.pos }]}>{formatMoney(myPosition.amount)} to receive</Text>
                  <Text style={[styles.heroSub, { color: colors.inkSoft }]}>
                    You don{"'"}t need to add money. The group is settling its remaining balances.
                  </Text>
                </>
              )}

              {myPosition.kind === 'pool_only' && (
                <>
                  <Text style={[styles.heroAmt, { color: colors.neg }]}>{formatMoney(myPosition.amount)} to add</Text>
                  {plan.amountNeeded > 0 && (
                    <Text style={[styles.heroSub, { color: colors.inkSoft }]}>
                      The group pool is short by {formatMoney(plan.amountNeeded)}.
                    </Text>
                  )}
                  {canAdd && (
                    <View style={styles.heroAction}>
                      <PrimaryButton label={`Add ${formatMoney(myPosition.amount)}`} onPress={() => goAddToPool(myPosition.amount)} />
                    </View>
                  )}
                </>
              )}

              {myPosition.kind === 'member_only' && (
                <>
                  <Text style={[styles.heroAmt, { color: colors.neg }]}>{formatMoney(myPosition.amount)} to settle</Text>
                  <View style={styles.heroActions}>
                    {myPosition.memberTransfers.map((t) => (
                      <View key={t.toMemberId} style={styles.heroAction}>
                        {canRecordPayment ? (
                          <PrimaryButton
                            label={`Pay ${memberName(t.toMemberId)} ${formatMoney(t.amount)}`}
                            onPress={() => openTransfer({ from: me!.id, to: t.toMemberId, amount: t.amount })}
                          />
                        ) : (
                          <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                            Pay {memberName(t.toMemberId)} {formatMoney(t.amount)}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {myPosition.kind === 'pool_and_member' && (
                <>
                  <Text style={[styles.heroAmt, { color: colors.neg }]}>{formatMoney(myPosition.amount)} to settle</Text>
                  <View style={[styles.breakdown, { backgroundColor: colors.surfaceSunk }]}>
                    <Text style={[styles.breakdownLbl, { color: colors.inkSoft }]}>BREAKDOWN</Text>
                    <View style={styles.breakdownRow}>
                      <Text style={{ color: colors.ink, fontSize: 14 }}>To restore the group pool</Text>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{formatMoney(myPosition.poolAmount)}</Text>
                    </View>
                    {myPosition.memberTransfers.map((t) => (
                      <View key={t.toMemberId} style={styles.breakdownRow}>
                        <Text style={{ color: colors.ink, fontSize: 14 }}>To {memberName(t.toMemberId)}</Text>
                        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{formatMoney(t.amount)}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.heroActions}>
                    {canAdd && (
                      <View style={styles.heroAction}>
                        <PrimaryButton
                          label={`Add ${formatMoney(myPosition.poolAmount)} to Pool`}
                          onPress={() => goAddToPool(myPosition.poolAmount)}
                        />
                      </View>
                    )}
                    {canRecordPayment &&
                      myPosition.memberTransfers.map((t) => (
                        <View key={t.toMemberId} style={styles.heroAction}>
                          <SecondaryButton
                            label={`Pay ${memberName(t.toMemberId)} ${formatMoney(t.amount)}`}
                            onPress={() => openTransfer({ from: me!.id, to: t.toMemberId, amount: t.amount })}
                          />
                        </View>
                      ))}
                  </View>
                </>
              )}

              {myPosition.kind === 'settled' && (
                <Text style={[styles.heroAmt, { color: colors.ink }]}>{'✓ You’re settled'}</Text>
              )}
            </View>
          )
        )}

        {myExplain && myPosition && myPosition.kind !== 'settled' && !allSettled && (
          <View style={styles.calcWrap}>
            <Pressable onPress={() => setShowCalculation((s) => !s)}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>
                {showCalculation ? 'Hide calculation' : 'See calculation'}
              </Text>
            </Pressable>
            {showCalculation && (
              <View style={[styles.calcCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <CalcRow label="You contributed" value={formatMoney(myExplain.contributed)} colors={colors} />
                <CalcRow label="Your share of expenses" value={`-${formatMoney(myExplain.expenseShare)}`} colors={colors} />
                {myExplain.paidForGroup > 0 && (
                  <CalcRow label="You paid personally for the group" value={`+${formatMoney(myExplain.paidForGroup)}`} colors={colors} />
                )}
                {myExplain.settlementsSent > 0 && (
                  <CalcRow label="Settlements you sent" value={`+${formatMoney(myExplain.settlementsSent)}`} colors={colors} />
                )}
                {myExplain.settlementsReceived > 0 && (
                  <CalcRow label="Settlements you received" value={`-${formatMoney(myExplain.settlementsReceived)}`} colors={colors} />
                )}
                <View style={[styles.calcTotalRow, { borderTopColor: colors.line }]}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>Net position</Text>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{formatMoney(myExplain.net, { showSign: true })}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {!allSettled && plan.target > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>GROUP PROGRESS</Text>
            <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Text style={[styles.progressTitle, { color: colors.ink }]}>Pool funding</Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSunk }]}>
                <View style={[styles.progressFill, { width: `${fundingPct}%`, backgroundColor: colors.accent }]} />
              </View>
              <Text style={[styles.progressAmt, { color: colors.inkSoft }]}>
                {formatMoney(plan.funded)} / {formatMoney(plan.target)}
                {plan.amountNeeded > 0 ? `  ·  ${formatMoney(plan.amountNeeded)} remaining` : ''}
              </Text>

              {plan.contributions.length > 0 && (
                <View style={styles.contribList}>
                  {plan.contributions.map((c) => (
                    <View key={c.memberId} style={styles.contribRow}>
                      <Text style={{ color: colors.ink, fontSize: 14 }}>{memberName(c.memberId)}</Text>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{formatMoney(c.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
              {plan.amountNeeded === 0 && (
                <Text style={[styles.progressDone, { color: colors.pos }]}>{'✓ Pool funding complete'}</Text>
              )}
            </View>
          </>
        )}

        {!allSettled && (
          <>
            <View style={styles.sectionHeadRow}>
              <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>MEMBER SETTLEMENT</Text>
              {poolBalanced && memberTransfers.length > 0 && (
                <Text style={{ color: colors.inkSoft, fontSize: 12.5 }}>
                  {memberTransfers.length} payment{memberTransfers.length !== 1 ? 's' : ''} remaining
                </Text>
              )}
            </View>

            {!poolBalanced ? (
              <EmptyState icon="⏳" title="Waiting for the pool to be balanced" subtitle="Member-to-member settlement starts once the shared Pool is fully funded." />
            ) : memberTransfers.length === 0 ? (
              <EmptyState icon="✅" title="Nothing to settle" subtitle="Everyone in this pot is already even." />
            ) : (
              <>
                <Text style={[styles.poolBalancedNote, { color: colors.pos }]}>{'✓ Pool balanced — now settle remaining member balances.'}</Text>
                {memberTransfers.map((t, i) => (
                  <SettlementCard
                    key={`grp-${t.from}-${t.to}-${i}`}
                    fromName={memberName(t.from)}
                    toName={memberName(t.to)}
                    amount={t.amount}
                    onMarkPaid={() => openTransfer(t)}
                    readOnly={!canRecordPayment}
                  />
                ))}
              </>
            )}
          </>
        )}

        {history.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>SETTLEMENT HISTORY</Text>
            <View style={[styles.historyList, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {history.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/pot/${id}/transaction/${t.id}`)}
                  style={[styles.historyRow, { borderBottomColor: colors.line }]}>
                  <View style={styles.flex1}>
                    <Text style={[styles.historyNames, { color: colors.ink }]} numberOfLines={1}>
                      {'✓ '}
                      {memberName(t.paidBy ?? '')} → {memberName(t.toMember ?? '')}
                    </Text>
                    <Text style={[styles.historySub, { color: colors.inkSoft }]}>
                      {formatDate(t.date)} {'·'} {paymentMethodLabel(t.paymentMethod)}
                    </Text>
                  </View>
                  <Text style={[styles.historyAmt, { color: colors.ink }]}>{formatMoney(t.amount)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <RecordPaymentModal
        key={paymentNonce}
        visible={!!activeTransfer}
        fromName={activeTransfer ? memberName(activeTransfer.from) : ''}
        toName={activeTransfer ? memberName(activeTransfer.to) : ''}
        outstandingPaise={activeTransfer?.amount ?? 0}
        onCancel={closeModal}
        onConfirm={confirmPayment}
      />
    </SafeAreaView>
  );
}

function CalcRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof usePottoColors> }) {
  return (
    <View style={styles.calcRow}>
      <Text style={{ color: colors.inkSoft, fontSize: 13.5 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  hero: { paddingVertical: 20, paddingHorizontal: 24, alignItems: 'center' },
  heroTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  heroLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6 },
  heroAmt: { fontSize: 28, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  heroSub: { fontSize: 13, marginTop: 6, textAlign: 'center' },
  heroActions: { marginTop: 16, gap: 10, alignItems: 'center', width: '100%' },
  heroAction: { marginTop: 16, alignItems: 'center', width: '100%' },
  totalSpendPill: { alignItems: 'center', borderRadius: Radius.lg, paddingVertical: 14, paddingHorizontal: 20, marginTop: 18 },
  breakdown: { width: '100%', borderRadius: Radius.md, padding: 14, marginTop: 14 },
  breakdownLbl: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  calcWrap: { paddingHorizontal: 24, alignItems: 'center', marginTop: 2 },
  calcCard: { width: '100%', borderRadius: Radius.md, borderWidth: 1, padding: 14, marginTop: 10 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  calcTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTopWidth: 1 },
  sectionHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  flex1: { flex: 1, minWidth: 0 },
  progressCard: { marginHorizontal: 20, padding: 16, borderRadius: Radius.lg, borderWidth: 1 },
  progressTitle: { fontSize: 14.5, fontWeight: '600' },
  progressTrack: { height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressAmt: { fontSize: 12.5, marginTop: 10 },
  progressDone: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  contribList: { marginTop: 14, gap: 2 },
  contribRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  poolBalancedNote: { fontSize: 13, fontWeight: '600', paddingHorizontal: 20, paddingBottom: 10 },
  historyList: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1 },
  historyNames: { fontSize: 14, fontWeight: '600' },
  historySub: { fontSize: 12, marginTop: 1 },
  historyAmt: { fontSize: 14.5, fontWeight: '700' },
});
