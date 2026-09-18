import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, usePottoColors } from '@/constants/potto-theme';
import type { DueDateState } from '@/logic/commitments';
import { calculateCommitmentPaid, calculateCommitmentRemaining, deriveCommitmentStatus, deriveDueDateState } from '@/logic/commitments';
import type { Commitment, CommitmentPayment, Transaction } from '@/types/models';
import { formatDate, formatMoney } from '@/utils/money';

const CATEGORY_ICON: Record<string, string> = {
  Stay: '🏨',
  Accommodation: '🏨',
  Food: '🍽️',
  Transport: '🚐',
  Activities: '🎟️',
  Tickets: '🎟️',
  Event: '🎉',
  Venue: '🏛️',
  Photography: '📷',
  Shopping: '🛍️',
  Fuel: '⛽',
  Groceries: '🛒',
  Drinks: '🥤',
};

export function commitmentIcon(category?: string): string {
  return (category && CATEGORY_ICON[category]) || '📌';
}

export const DUE_DATE_LABEL: Record<DueDateState, string> = {
  upcoming: 'Upcoming',
  due_soon: 'Due Soon',
  due_today: 'Due Today',
  overdue: 'Overdue',
  paid: 'Fully Paid',
  cancelled: 'Cancelled',
  no_due_date: 'No due date',
};

export function dueDateBadgeColors(state: DueDateState, colors: ReturnType<typeof usePottoColors>) {
  switch (state) {
    case 'overdue':
      return { bg: colors.negSoft, fg: colors.neg };
    case 'due_today':
    case 'due_soon':
      return { bg: colors.goldSoft, fg: colors.gold };
    case 'paid':
      return { bg: colors.posSoft, fg: colors.pos };
    default:
      return { bg: colors.surfaceSunk, fg: colors.inkSoft };
  }
}

export function CommitmentCard({
  commitment,
  payments,
  transactions,
  onPress,
}: {
  commitment: Commitment;
  payments: CommitmentPayment[];
  transactions: Transaction[];
  onPress: () => void;
}) {
  const colors = usePottoColors();
  const paid = calculateCommitmentPaid(commitment.id, payments, transactions);
  const remaining = calculateCommitmentRemaining(commitment, payments, transactions);
  const status = deriveCommitmentStatus(commitment, paid);
  const dueState = deriveDueDateState(commitment, status);
  const badge = dueDateBadgeColors(dueState, colors);
  const progress = commitment.totalAmount > 0 ? Math.min(100, (paid / commitment.totalAmount) * 100) : 0;

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.headRow}>
        <Text style={styles.icon}>{commitmentIcon(commitment.category)}</Text>
        <View style={styles.flex1}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {commitment.vendorName || commitment.title}
          </Text>
          {!!commitment.vendorName && commitment.title !== commitment.vendorName && (
            <Text style={[styles.sub, { color: colors.inkSoft }]} numberOfLines={1}>
              {commitment.title}
            </Text>
          )}
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={{ color: badge.fg, fontSize: 10, fontWeight: '700' }}>{DUE_DATE_LABEL[dueState].toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.amountsRow}>
        <AmountCol label="Total" value={commitment.totalAmount} color={colors.ink} muted={colors.inkSoft} />
        <AmountCol label="Paid" value={paid} color={colors.pos} muted={colors.inkSoft} />
        <AmountCol label="Remaining" value={remaining} color={remaining > 0 ? colors.neg : colors.inkSoft} muted={colors.inkSoft} />
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSunk }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progress}%` }]} />
      </View>

      {!!commitment.dueDate && dueState !== 'paid' && dueState !== 'cancelled' && (
        <Text style={[styles.due, { color: colors.inkSoft }]}>Due {formatDate(commitment.dueDate)}</Text>
      )}
    </Pressable>
  );
}

function AmountCol({ label, value, color, muted }: { label: string; value: number; color: string; muted: string }) {
  return (
    <View style={styles.amountCol}>
      <Text style={[styles.amountLabel, { color: muted }]}>{label}</Text>
      <Text style={[styles.amountValue, { color }]}>{formatMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: Radius.lg, borderWidth: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 22 },
  flex1: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  amountsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  amountCol: {},
  amountLabel: { fontSize: 10.5, letterSpacing: 0.4 },
  amountValue: { fontSize: 14.5, fontWeight: '700', marginTop: 2 },
  progressTrack: { height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  due: { fontSize: 12, marginTop: 8 },
});
