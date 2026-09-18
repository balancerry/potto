import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/potto/Button';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { PottoColors, Radius, usePottoColors } from '@/constants/potto-theme';
import { explainBalance } from '@/logic/accounting';
import { usePottoStore } from '@/store/PottoStore';
import { formatMoney } from '@/utils/money';

export default function BalanceScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId?: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember } = usePottoStore();
  const pot = getPot(id);
  const me = memberId ? pot?.members.find((m) => m.id === memberId) : getCurrentMember(id);
  const txs = getTransactions(id);
  const title = memberId ? `${me?.name ?? ''}'s Balance` : 'My Balance';

  if (!pot || !me) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title={title} onBack={() => router.back()} />
        <EmptyState icon="❓" title="Not available" subtitle="You are not a member of this pot." />
      </SafeAreaView>
    );
  }

  const b = explainBalance(txs, me.id);
  const settled = b.net === 0;
  const subject = memberId ? me.name : 'You';
  const possessive = memberId ? `${me.name}'s` : 'Your';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={[styles.heroLabel, { color: colors.inkSoft }]}>Current position</Text>
          <Text style={[styles.heroAmt, { color: settled ? colors.ink : b.net > 0 ? colors.pos : colors.neg }]}>
            {settled
              ? 'All settled up'
              : b.net > 0
                ? `${subject} should receive ${formatMoney(b.net)}`
                : `${subject} owe${memberId ? 's' : ''} ${formatMoney(-b.net)}`}
          </Text>
        </View>

        <View style={[styles.rows, { borderColor: colors.line }]}>
          <ExplainRow label={`${subject} contributed`} value={formatMoney(b.contributed)} colors={colors} />
          <ExplainRow label={`${possessive} fair share of expenses`} value={`-${formatMoney(b.expenseShare)}`} colors={colors} />
          <ExplainRow label={`${subject} paid personally for the group`} value={`+${formatMoney(b.paidForGroup)}`} colors={colors} />
          <ExplainRow label={`Settlements ${memberId ? me.name : 'you'} sent`} value={`+${formatMoney(b.settlementsSent)}`} colors={colors} />
          <ExplainRow label={`Settlements ${memberId ? me.name : 'you'} received`} value={`-${formatMoney(b.settlementsReceived)}`} colors={colors} />
          <View style={[styles.totalRow, { backgroundColor: colors.surfaceSunk }]}>
            <Text style={[styles.totalLbl, { color: colors.ink }]}>Net position</Text>
            <Text style={[styles.totalVal, { color: settled ? colors.ink : b.net > 0 ? colors.pos : colors.neg }]}>
              {formatMoney(b.net, { showSign: true })}
            </Text>
          </View>
        </View>

        <View style={styles.settleAction}>
          <Button label="View Settlement" onPress={() => router.push(`/pot/${id}/settle`)} variant="secondary" fullWidth />
        </View>

        <Text style={[styles.footnote, { color: colors.inkSoft }]}>
          This is calculated directly from every contribution, expense, and settlement recorded in the pot{"'"}s ledger.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ExplainRow({ label, value, colors }: { label: string; value: string; colors: PottoColors }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Text style={{ color: colors.inkSoft, fontSize: 14.5 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 14.5 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
  heroLabel: { fontSize: 12.5, marginBottom: 6 },
  heroAmt: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  rows: { marginHorizontal: 20, borderRadius: Radius.lg, overflow: 'hidden' },
  settleAction: { paddingHorizontal: 20, paddingTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 20 },
  totalLbl: { fontWeight: '700', fontSize: 15.5 },
  totalVal: { fontWeight: '700', fontSize: 15.5 },
  footnote: { fontSize: 12.5, paddingHorizontal: 24, paddingTop: 18, lineHeight: 18, textAlign: 'center' },
});
