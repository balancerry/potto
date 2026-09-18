import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePottoColors } from '@/constants/potto-theme';
import type { Transaction } from '@/types/models';
import { formatDate, formatMoney } from '@/utils/money';

const TYPE_ICON: Record<Transaction['type'], string> = {
  contribution: '↓',
  pool_expense: '↑',
  member_expense: '👤',
  settlement: '⇄',
};

const TYPE_LABEL: Record<Transaction['type'], string> = {
  contribution: 'Contribution',
  pool_expense: 'Pool Expense',
  member_expense: 'Member Expense',
  settlement: 'Settlement',
};

export function TransactionRow({
  transaction,
  memberName,
  onPress,
}: {
  transaction: Transaction;
  memberName: (id?: string) => string;
  onPress: () => void;
}) {
  const colors = usePottoColors();
  const t = transaction;

  const iconBg = {
    contribution: colors.posSoft,
    pool_expense: colors.negSoft,
    member_expense: colors.goldSoft,
    settlement: colors.accentSoft,
  }[t.type];
  const iconFg = {
    contribution: colors.pos,
    pool_expense: colors.neg,
    member_expense: colors.gold,
    settlement: colors.accent,
  }[t.type];

  const isPositive = t.type === 'contribution';
  const isNegative = t.type === 'pool_expense' || t.type === 'member_expense';
  const amtColor = isPositive ? colors.pos : isNegative ? colors.neg : colors.ink;
  const sign = isPositive ? '+' : isNegative ? '-' : '';

  let subtitle = TYPE_LABEL[t.type];
  if (t.type === 'contribution') subtitle = `${memberName(t.paidBy)} · ${TYPE_LABEL[t.type]}`;
  if (t.type === 'member_expense') subtitle = `Paid by ${memberName(t.paidBy)}`;
  if (t.type === 'settlement') subtitle = `${memberName(t.paidBy)} → ${memberName(t.toMember)}`;

  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: colors.line }]}>
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 16, color: iconFg }}>{TYPE_ICON[t.type]}</Text>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
          {t.description}
        </Text>
        <Text numberOfLines={1} style={[styles.sub, { color: colors.inkSoft }]}>
          {subtitle} {'·'} {formatDate(t.date)}
        </Text>
      </View>
      <Text style={[styles.amt, { color: amtColor }]}>
        {sign}
        {formatMoney(t.amount)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14.5, fontWeight: '600' },
  sub: { fontSize: 12.5, marginTop: 1 },
  amt: { fontSize: 15.5, fontWeight: '600', flexShrink: 0 },
});
