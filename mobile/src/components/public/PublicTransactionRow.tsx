import { StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { usePottoColors } from '@/constants/potto-theme';
import {
  activityKind,
  activityTitle,
  expensePayer,
  formatPublicDate,
  participantSummary,
  type PublicTransaction,
} from '@/logic/public-pot';
import { formatMoney } from '@/utils/money';

const TYPE_GLYPH: Record<PublicTransaction['type'], string> = {
  contribution: '↓',
  pool_expense: '↑',
  member_expense: '👤',
  settlement: '⇄',
};

/** Where the row appears decides how much it says: the Activity feed is terse, Expenses adds who paid and who shared it. */
export type PublicRowVariant = 'activity' | 'contribution' | 'expense';

/** One read-only ledger line. Not pressable, no chevron: there is nothing to open. */
export function PublicTransactionRow({ tx, variant }: { tx: PublicTransaction; variant: PublicRowVariant }) {
  const colors = usePottoColors();

  const chipBg = {
    contribution: colors.posSoft,
    pool_expense: colors.negSoft,
    member_expense: colors.goldSoft,
    settlement: colors.accentSoft,
  }[tx.type];
  const chipFg = {
    contribution: colors.pos,
    pool_expense: colors.neg,
    member_expense: colors.gold,
    settlement: colors.accent,
  }[tx.type];

  const isIn = tx.type === 'contribution';
  const isOut = tx.type === 'pool_expense' || tx.type === 'member_expense';
  const amountColor = isIn ? colors.pos : isOut ? colors.neg : colors.ink;

  const date = formatPublicDate(tx.date);
  const category = tx.category?.name;
  let title = activityTitle(tx);
  let meta = [date, activityKind(tx.type), category].filter(Boolean).join(' · ');
  let detail = '';
  if (variant === 'contribution') {
    title = tx.paidBy ?? 'Someone';
    meta = date;
    detail = tx.description && tx.description !== 'Trip contribution' ? tx.description : '';
  } else if (variant === 'expense') {
    meta = [date, category].filter(Boolean).join(' · ');
    detail = [expensePayer(tx), participantSummary(tx.participants)].filter(Boolean).join(' · ');
  }

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {variant === 'expense' && tx.category ? (
        <CategoryIcon icon={tx.category.icon} color={tx.category.color} size={38} />
      ) : (
        <View style={[styles.chip, { backgroundColor: chipBg }]}>
          <Text style={{ color: chipFg, fontSize: 16, fontWeight: '700' }}>{TYPE_GLYPH[tx.type]}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.inkSoft }]}>
          {meta}
        </Text>
        {detail ? (
          <Text numberOfLines={2} style={[styles.meta, { color: colors.inkSoft }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {isIn ? '+' : ''}
        {formatMoney(tx.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  chip: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14.5, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  amount: { fontSize: 14.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
