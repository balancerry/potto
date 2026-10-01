import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/potto/Button';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { calculateAccountBalance } from '@/logic/pool-money';
import { usePottoStore } from '@/store/PottoStore';
import { formatMoney, toPaise, toRupees } from '@/utils/money';

export default function ReconcileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getTransactions, getPoolAccounts } = usePottoStore();
  const accounts = getPoolAccounts(id).filter((a) => a.active);
  const txs = getTransactions(id);
  const potto = Object.fromEntries(accounts.map((a) => [a.id, calculateAccountBalance(txs, a.id)]));
  const [actual, setActual] = useState<Record<string, string>>(() =>
    Object.fromEntries(accounts.map((a) => [a.id, String(toRupees(potto[a.id] ?? 0))])),
  );
  const pottoTotal = accounts.reduce((sum, a) => sum + (potto[a.id] ?? 0), 0);
  const actualTotal = accounts.reduce((sum, a) => {
    const n = Number(actual[a.id]);
    return sum + (Number.isFinite(n) ? toPaise(n) : 0);
  }, 0);
  const diff = actualTotal - pottoTotal;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Reconcile" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={{ color: colors.inkSoft }}>Potto balance</Text>
        {accounts.map((a) => (
          <View key={a.id} style={styles.line}>
            <Text style={{ color: colors.ink }}>{a.name}</Text>
            <Text style={{ color: colors.ink }}>{formatMoney(potto[a.id] ?? 0)}</Text>
          </View>
        ))}
        <Text style={[styles.total, { color: colors.ink }]}>Total {formatMoney(pottoTotal)}</Text>
        <Text style={{ color: colors.inkSoft, marginTop: 16 }}>Actual balance</Text>
        {accounts.map((a) => (
          <TextInput
            key={a.id}
            value={actual[a.id] ?? ''}
            onChangeText={(value) => setActual((prev) => ({ ...prev, [a.id]: value }))}
            placeholder={a.name}
            keyboardType="decimal-pad"
            style={[styles.input, { color: colors.ink, borderColor: colors.line }]}
          />
        ))}
        <Text style={{ color: colors.ink, marginVertical: 8 }}>Actual total {formatMoney(actualTotal)}</Text>
        {diff !== 0 ? (
          <View style={[styles.warn, { backgroundColor: colors.goldSoft }]}>
            <Text style={{ color: colors.ink, fontWeight: '700' }}>{formatMoney(Math.abs(diff))} difference found.</Text>
            <Text style={{ color: colors.inkSoft }}>Potto says: {formatMoney(pottoTotal)}</Text>
            <Text style={{ color: colors.inkSoft }}>Actual: {formatMoney(actualTotal)}</Text>
            <Text style={{ color: colors.inkSoft }}>Difference: {formatMoney(diff)}</Text>
          </View>
        ) : (
          <Text style={{ color: colors.inkSoft }}>Totals match. Nothing was changed.</Text>
        )}
        <Button label="Review transactions" onPress={() => router.push(`/pot/${id}/transactions`)} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  total: { fontWeight: '700', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12 },
  warn: { borderRadius: 12, padding: 12, gap: 4, marginVertical: 8 },
});
