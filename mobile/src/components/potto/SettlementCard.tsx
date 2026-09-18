import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/potto/Avatar';
import { Button } from '@/components/potto/Button';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { formatMoney } from '@/utils/money';

export function SettlementCard({
  fromName,
  toName,
  amount,
  onMarkPaid,
  readOnly,
}: {
  fromName: string;
  toName: string;
  amount: number;
  onMarkPaid: () => void;
  readOnly?: boolean;
}) {
  const colors = usePottoColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.headRow}>
        <Avatar name={fromName} size={34} />
        <Text style={{ color: colors.inkSoft, fontSize: 15 }}>{'→'}</Text>
        <Avatar name={toName} size={34} />
        <View style={styles.flex1}>
          <Text style={[styles.names, { color: colors.ink }]} numberOfLines={1}>
            {fromName} → {toName}
          </Text>
          <Text style={[styles.label, { color: colors.inkSoft }]}>Settlement</Text>
        </View>
        <Text style={[styles.amount, { color: colors.ink }]}>{formatMoney(amount)}</Text>
      </View>
      {!readOnly && (
        <View style={styles.footer}>
          <Button label="Mark as Paid" onPress={onMarkPaid} variant="secondary" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: Radius.lg, borderWidth: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex1: { flex: 1, minWidth: 0 },
  names: { fontSize: 14.5, fontWeight: '600' },
  label: { fontSize: 12, marginTop: 1 },
  amount: { fontSize: 16.5, fontWeight: '700', flexShrink: 0 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
});
