import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { commitmentIcon, dueDateBadgeColors, DUE_DATE_LABEL } from '@/components/potto/CommitmentCard';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  deriveCommitmentStatus,
  deriveDueDateState,
} from '@/logic/commitments';
import { canAddCommitmentPayment, canCancelCommitment, canEditCommitment } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { CommitmentStatus } from '@/types/models';
import { formatDateFull, formatMoney } from '@/utils/money';

const STATUS_LABEL: Record<CommitmentStatus, string> = {
  planned: 'Planned',
  partially_paid: 'Partially Paid',
  fully_paid: 'Fully Paid',
  cancelled: 'Cancelled',
};

export default function CommitmentDetailScreen() {
  const { id, commitmentId } = useLocalSearchParams<{ id: string; commitmentId: string }>();
  const colors = usePottoColors();
  const { getPot, getCommitment, getCommitmentPayments, getTransactions, getCurrentMember, cancelCommitment } =
    usePottoStore();
  const { showToast } = useToast();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const pot = getPot(id);
  const me = getCurrentMember(id);
  const commitment = getCommitment(id, commitmentId);
  const transactions = getTransactions(id);
  const payments = commitment ? getCommitmentPayments(id, commitment.id) : [];

  const memberName = (memberId?: string) => pot?.members.find((m) => m.id === memberId)?.name ?? '—';

  if (!pot || !commitment) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Upcoming Payment" onBack={() => router.back()} />
        <EmptyState icon="❓" title="Not found" subtitle="This Upcoming Payment may have been removed." />
      </SafeAreaView>
    );
  }

  const paid = calculateCommitmentPaid(commitment.id, payments, transactions);
  const remaining = calculateCommitmentRemaining(commitment, payments, transactions);
  const status = deriveCommitmentStatus(commitment, paid);
  const dueState = deriveDueDateState(commitment, status);
  const badge = dueDateBadgeColors(dueState, colors);

  const paymentRows = payments
    .map((p) => ({ payment: p, tx: transactions.find((t) => t.id === p.transactionId) }))
    .filter((r) => !!r.tx)
    .sort((a, b) => (a.tx!.date < b.tx!.date ? 1 : -1));

  const canCancel = canCancelCommitment(me) && status !== 'cancelled' && status !== 'fully_paid';
  const canEdit = canEditCommitment(me, commitment);
  const canPay = canAddCommitmentPayment(me) && status !== 'cancelled' && remaining > 0;

  const confirmCancel = async () => {
    setConfirmVisible(false);
    const result = await cancelCommitment(id, commitment.id);
    if (result.ok) {
      showToast('Upcoming Payment cancelled');
    } else {
      showToast(result.reason);
    }
  };

  const menuItems = [
    ...(canEdit ? [{ label: 'Edit', onPress: () => router.push(`/pot/${id}/add-commitment?editId=${commitment.id}`) }] : []),
    ...(canCancel ? [{ label: 'Cancel', onPress: () => setConfirmVisible(true), destructive: true }] : []),
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader
        title="Upcoming Payment"
        onBack={() => router.back()}
        right={menuItems.length > 0 ? <ActionMenu items={menuItems} /> : undefined}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.icon}>{commitmentIcon(commitment.category)}</Text>
          <Text style={[styles.title, { color: colors.ink }]}>{commitment.vendorName || commitment.title}</Text>
          {!!commitment.vendorName && commitment.title !== commitment.vendorName && (
            <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{commitment.title}</Text>
          )}
          <View style={[styles.badge, { backgroundColor: badge.bg, marginTop: 10 }]}>
            <Text style={{ color: badge.fg, fontSize: 11, fontWeight: '700' }}>{DUE_DATE_LABEL[dueState].toUpperCase()}</Text>
          </View>
        </View>

        <View style={[styles.amountsCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <AmountRow label="Total" value={commitment.totalAmount} colors={colors} />
          <AmountRow label="Paid" value={paid} colors={colors} valueColor={colors.pos} />
          <AmountRow label="Remaining" value={remaining} colors={colors} valueColor={remaining > 0 ? colors.neg : colors.inkSoft} last />
        </View>

        <View style={[styles.rows, { borderColor: colors.line }]}>
          <Row label="Status" value={STATUS_LABEL[status]} colors={colors} />
          {commitment.dueDate && <Row label="Due date" value={formatDateFull(commitment.dueDate)} colors={colors} />}
          {commitment.category && <Row label="Category" value={commitment.category} colors={colors} />}
          {commitment.description && <Row label="Notes" value={commitment.description} colors={colors} />}
          <Row label="Created by" value={memberName(commitment.createdBy)} colors={colors} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>PAYMENT HISTORY</Text>
        {paymentRows.length === 0 ? (
          <EmptyState icon="🪙" title="No payments yet" subtitle="Add a payment from the Pool or personally to start paying this down." />
        ) : (
          <View style={[styles.txList, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {paymentRows.map(({ payment, tx }) => (
              <Pressable
                key={payment.id}
                onPress={() => router.push(`/pot/${id}/transaction/${tx!.id}`)}
                style={[styles.txRow, { borderBottomColor: colors.line }]}>
                <View style={styles.flex1}>
                  <Text style={[styles.txAmount, { color: colors.ink }]}>{formatMoney(tx!.amount)}</Text>
                  <Text style={[styles.txSub, { color: colors.inkSoft }]}>
                    {tx!.paymentSource === 'pool' ? 'Pool' : `Paid by ${memberName(tx!.paidBy)}`} · {formatDateFull(tx!.date)}
                  </Text>
                </View>
                <Text style={{ color: colors.inkSoft, fontSize: 16 }}>{'›'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {canPay && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push(`/pot/${id}/add-expense?linkCommitmentId=${commitment.id}`)}
              style={[styles.payBtn, { backgroundColor: colors.ink }]}>
              <Text style={{ color: colors.paper, fontWeight: '600', fontSize: 14.5 }}>Add Payment</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Cancel this Upcoming Payment?"
        message={`This will mark "${commitment.vendorName || commitment.title}" as cancelled. Existing payments and transactions are kept in history.`}
        confirmLabel="Cancel Payment"
        destructive
        onConfirm={confirmCancel}
        onCancel={() => setConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof usePottoColors> }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Text style={{ color: colors.inkSoft, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

function AmountRow({
  label,
  value,
  colors,
  valueColor,
  last,
}: {
  label: string;
  value: number;
  colors: ReturnType<typeof usePottoColors>;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.amountRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      <Text style={{ color: colors.inkSoft, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: valueColor ?? colors.ink, fontSize: 17, fontWeight: '700' }}>{formatMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13.5, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  amountsCard: { marginHorizontal: 20, marginTop: 10, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 16 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  rows: { marginHorizontal: 20, marginTop: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 6 },
  txList: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1 },
  flex1: { flex: 1, minWidth: 0 },
  txAmount: { fontSize: 15, fontWeight: '600' },
  txSub: { fontSize: 12.5, marginTop: 2 },
  actions: { paddingHorizontal: 20, paddingTop: 20 },
  payBtn: { paddingVertical: 14, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
});
