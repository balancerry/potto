import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/potto/Button';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { calculatePoolBalance, sortTransactionsRecentFirst } from '@/logic/accounting';
import { activityDetail, calculateAccountBalance } from '@/logic/pool-money';
import { canAddExpense, canAddMoney, canManagePoolMoney } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { formatDate, formatMoney } from '@/utils/money';

export default function PoolMoneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, getPoolAccounts, getPoolManagerMemberId } = usePottoStore();
  const pot = getPot(id);
  const txs = getTransactions(id);
  const me = getCurrentMember(id);
  const accounts = getPoolAccounts(id).filter((a) => a.active);
  const managerId = getPoolManagerMemberId(id);
  if (!pot) return null;

  const nameOf = (memberId?: string) => pot.members.find((m) => m.id === memberId)?.name ?? '—';
  const accountName = (accountId?: string) => accounts.find((a) => a.id === accountId)?.name ?? 'Pool';
  const movement = sortTransactionsRecentFirst(txs)
    .filter((t) => t.type === 'contribution' || t.type === 'pool_expense' || t.type === 'pool_transfer')
    .slice(0, 12);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Pool money" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.total, { color: colors.ink }]}>{formatMoney(calculatePoolBalance(txs))}</Text>
        <Text style={{ color: colors.inkSoft, marginBottom: 16 }}>Total pool</Text>
        {accounts.map((account) => (
          <View key={account.id} style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.inkSoft }}>{account.name}</Text>
            <Text style={[styles.amount, { color: colors.ink }]}>{formatMoney(calculateAccountBalance(txs, account.id))}</Text>
          </View>
        ))}
        <View style={styles.actions}>
          {canAddMoney(me, managerId) ? <Button label="Add contribution" onPress={() => router.push(`/pot/${id}/add-money`)} /> : null}
          {canAddExpense(me, managerId) ? <Button label="Add expense" onPress={() => router.push(`/pot/${id}/add-expense`)} variant="secondary" /> : null}
          {canManagePoolMoney(me, managerId) ? <Button label="Transfer money" onPress={() => router.push(`/pot/${id}/transfer`)} variant="secondary" /> : null}
          <Button label="Reconcile" onPress={() => router.push(`/pot/${id}/reconcile`)} variant="secondary" />
        </View>
        <Text style={[styles.section, { color: colors.inkSoft }]}>RECENT POOL MOVEMENT</Text>
        {movement.map((tx) => (
          <Pressable key={tx.id} onPress={() => router.push(`/pot/${id}/transaction/${tx.id}`)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{tx.type === 'pool_transfer' ? 'Transfer' : tx.description}</Text>
              <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{formatDate(tx.date)} · {activityDetail(tx, nameOf, accountName)}</Text>
            </View>
            <Text style={{ color: colors.ink }}>{formatMoney(tx.amount)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  total: { fontSize: 32, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  amount: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  actions: { gap: 8, marginVertical: 16 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
