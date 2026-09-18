import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PottoFonts, Radius, usePottoColors } from '@/constants/potto-theme';
import { formatMoney } from '@/utils/money';

export function BalanceCard({ balance, onPress }: { balance: number; onPress: () => void }) {
  const colors = usePottoColors();
  const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;
  const settled = balance === 0;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.row}>
        <View>
          <Text style={[styles.lbl, { color: colors.inkSoft }]}>Your balance</Text>
          <Text
            style={[
              styles.amt,
              { color: settled ? colors.ink : balance > 0 ? colors.pos : colors.neg, fontFamily: displayFont },
            ]}>
            {settled ? formatMoney(0) : formatMoney(Math.abs(balance))}
          </Text>
          <Text style={[styles.sub, { color: colors.inkSoft }]}>
            {settled ? 'You are all settled up' : balance > 0 ? 'You should receive' : 'You owe the group'}
          </Text>
        </View>
        <Text style={{ color: colors.inkSoft, fontSize: 18 }}>{'›'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 16, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lbl: { fontSize: 12.5 },
  amt: { fontSize: 22, fontWeight: '600', marginTop: 2 },
  sub: { fontSize: 12.5, marginTop: 3 },
});
