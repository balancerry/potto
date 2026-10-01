import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryBadge } from '@/components/categories/CategoryIcon';
import { usePottoColors } from '@/constants/potto-theme';
import type { CategoryDisplay } from '@/logic/categories';
import { activityDetail } from '@/logic/pool-money';
import type { Transaction } from '@/types/models';
import { formatDate, formatMoney } from '@/utils/money';

const TYPE_ICON: Record<Transaction['type'], string> = {
  contribution: '↓',
  pool_expense: '↑',
  member_expense: '👤',
  settlement: '⇄',
  pool_transfer: '↔',
};

const TYPE_LABEL: Record<Transaction['type'], string> = {
  contribution: 'Contribution',
  pool_expense: 'Pool Expense',
  member_expense: 'Member Expense',
  settlement: 'Settlement',
  pool_transfer: 'Transfer',
};

export function TransactionRow({
  transaction,
  memberName,
  accountName,
  category,
  onPress,
}: {
  transaction: Transaction;
  memberName: (id?: string) => string;
  accountName?: (id?: string) => string;
  /** Resolved category for expenses; shown subtly after the date. */
  category?: CategoryDisplay;
  onPress: () => void;
}) {
  const colors = usePottoColors();
  const t = transaction;

  const iconBg = {
    contribution: colors.posSoft,
    pool_expense: colors.negSoft,
    member_expense: colors.goldSoft,
    settlement: colors.accentSoft,
    pool_transfer: colors.accentSoft,
  }[t.type];
  const iconFg = {
    contribution: colors.pos,
    pool_expense: colors.neg,
    member_expense: colors.gold,
    settlement: colors.accent,
    pool_transfer: colors.accent,
  }[t.type];

  const isPositive = t.type === 'contribution';
  const isNegative = t.type === 'pool_expense' || t.type === 'member_expense';
  const amtColor = isPositive ? colors.pos : isNegative ? colors.neg : colors.ink;
  const sign = isPositive ? '+' : isNegative ? '-' : '';

  const account = accountName ?? (() => 'Pool');
  let subtitle = activityDetail(t, memberName, account) || TYPE_LABEL[t.type];

  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: colors.line }]}>
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 16, color: iconFg }}>{TYPE_ICON[t.type]}</Text>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
          {t.description}
        </Text>
        <View style={styles.subRow}>
          <Text numberOfLines={1} style={[styles.sub, { color: colors.inkSoft, flexShrink: 1 }]}>
            {subtitle} {'·'} {formatDate(t.date)}
          </Text>
          {!!category && (
            <>
              <Text style={[styles.sub, { color: colors.inkSoft }]}>{' · '}</Text>
              <CategoryBadge category={category} />
            </>
          )}
        </View>
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
  sub: { fontSize: 12.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  amt: { fontSize: 15.5, fontWeight: '600', flexShrink: 0 },
});
