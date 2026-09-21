import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { paymentMethodLabel } from '@/constants/payment-methods';
import { usePottoColors } from '@/constants/potto-theme';
import { canDeleteTransaction, canEditTransaction } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { Transaction } from '@/types/models';
import { formatDateFull, formatMoney } from '@/utils/money';

const TYPE_LABEL: Record<Transaction['type'], string> = {
  contribution: 'Contribution',
  pool_expense: 'Pool Expense',
  member_expense: 'Member Expense',
  settlement: 'Settlement',
};

const TYPE_ICON: Record<Transaction['type'], string> = {
  contribution: '↓',
  pool_expense: '↑',
  member_expense: '👤',
  settlement: '⇄',
};

export default function TransactionDetailScreen() {
  const { id, txId } = useLocalSearchParams<{ id: string; txId: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, deleteTransaction } = usePottoStore();
  const { showToast } = useToast();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const pot = getPot(id);
  const me = getCurrentMember(id);
  const tx = getTransactions(id).find((t) => t.id === txId);

  const memberName = (memberId?: string) => pot?.members.find((m) => m.id === memberId)?.name ?? '—';

  if (!pot || !tx) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Transaction" onBack={() => router.back()} />
        <EmptyState icon="❓" title="Not found" subtitle="This transaction may have been removed." />
      </SafeAreaView>
    );
  }

  const handleEdit = () => {
    if (tx.type === 'contribution') {
      router.push(`/pot/${id}/add-money?editId=${tx.id}`);
    } else if (tx.type === 'pool_expense' || tx.type === 'member_expense') {
      router.push(`/pot/${id}/add-expense?editId=${tx.id}`);
    } else if (tx.type === 'settlement') {
      router.push(`/pot/${id}/edit-settlement?txId=${tx.id}`);
    }
  };

  const contextLine = tx.type === 'settlement' ? `${memberName(tx.paidBy)} → ${memberName(tx.toMember)}` : tx.description;
  const confirmDeleteMessage = `This will permanently remove:\n\n${contextLine}\n${formatMoney(tx.amount)}\n${formatDateFull(tx.date)}\n\nYour Pot balances will be recalculated.`;

  const confirmDelete = async () => {
    setConfirmVisible(false);
    try {
      await deleteTransaction(id, tx.id);
      showToast('Transaction deleted');
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete transaction');
    }
  };

  const menuItems = [
    ...(canEditTransaction(me, tx) ? [{ label: 'Edit', onPress: handleEdit }] : []),
    ...(canDeleteTransaction(me, tx) ? [{ label: 'Delete', onPress: () => setConfirmVisible(true), destructive: true }] : []),
  ];

  const isSettlement = tx.type === 'settlement';

  const iconBg = {
    contribution: colors.posSoft,
    pool_expense: colors.negSoft,
    member_expense: colors.goldSoft,
    settlement: colors.accentSoft,
  }[tx.type];
  const iconFg = {
    contribution: colors.pos,
    pool_expense: colors.neg,
    member_expense: colors.gold,
    settlement: colors.accent,
  }[tx.type];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader
        title={TYPE_LABEL[tx.type]}
        onBack={() => router.back()}
        right={menuItems.length > 0 ? <ActionMenu items={menuItems} /> : undefined}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: iconBg }]}>
            <Text style={{ fontSize: 24, color: iconFg }}>{TYPE_ICON[tx.type]}</Text>
          </View>
          {isSettlement ? (
            <View style={styles.settlementFlow}>
              <Text style={[styles.flowName, { color: colors.ink }]}>{memberName(tx.paidBy)}</Text>
              <Text style={{ color: colors.inkSoft, fontSize: 18, marginVertical: 2 }}>{'↓'}</Text>
              <Text style={[styles.flowName, { color: colors.ink }]}>{memberName(tx.toMember)}</Text>
            </View>
          ) : (
            <Text style={[styles.desc, { color: colors.ink }]}>{tx.description}</Text>
          )}
          <Text style={[styles.amt, { color: colors.ink }]}>{formatMoney(tx.amount)}</Text>
        </View>

        <View style={[styles.rows, { borderColor: colors.line }]}>
          {isSettlement && <Row label="Status" value="Completed" colors={colors} />}
          {tx.paidBy && (
            <Row label={isSettlement ? 'From' : 'Paid by'} value={memberName(tx.paidBy)} colors={colors} />
          )}
          {tx.toMember && <Row label="To" value={memberName(tx.toMember)} colors={colors} />}
          {isSettlement && <Row label="Payment method" value={paymentMethodLabel(tx.paymentMethod)} colors={colors} />}
          {tx.paymentSource && (
            <Row label="Source" value={tx.paymentSource === 'pool' ? 'Shared Pot' : 'Personal payment'} colors={colors} />
          )}
          {tx.category && <Row label="Category" value={tx.category} colors={colors} />}
          <Row label="Date" value={formatDateFull(tx.date)} colors={colors} />
          {tx.note && <Row label="Note" value={tx.note} colors={colors} />}
          <Row label="Created by" value={memberName(tx.createdBy)} colors={colors} />
        </View>

        {tx.splits && tx.splits.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>SPLIT DETAILS</Text>
            <View style={[styles.splitList, { borderColor: colors.line }]}>
              {tx.splits.map((s) => (
                <View key={s.memberId} style={[styles.splitRow, { borderBottomColor: colors.line }]}>
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}>{memberName(s.memberId)}</Text>
                  <Text style={{ color: colors.inkSoft, fontSize: 14 }}>{formatMoney(s.amount)}</Text>
                </View>
              ))}
              <View style={[styles.splitRow, { borderBottomWidth: 0, paddingTop: 10 }]}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>Total</Text>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{formatMoney(tx.amount)}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete transaction?"
        message={confirmDeleteMessage}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20 },
  icon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  desc: { fontSize: 19, fontWeight: '600' },
  settlementFlow: { alignItems: 'center' },
  flowName: { fontSize: 19, fontWeight: '600' },
  amt: { fontSize: 32, fontWeight: '700', marginTop: 4 },
  rows: { marginHorizontal: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  splitList: { marginHorizontal: 20 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
});
