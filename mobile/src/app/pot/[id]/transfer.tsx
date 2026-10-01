import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { calculateAccountBalance } from '@/logic/pool-money';
import { canManagePoolMoney } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import { formatMoney, toPaise } from '@/utils/money';

export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, getPoolAccounts, getPoolManagerMemberId, transferPoolMoney } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const accounts = getPoolAccounts(id).filter((a) => a.active);
  const txs = getTransactions(id);
  const me = getCurrentMember(id);
  const managerId = getPoolManagerMemberId(id);
  const [fromId, setFromId] = useState(accounts.find((a) => a.type === 'bank')?.id ?? accounts[0]?.id ?? '');
  const [toId, setToId] = useState(accounts.find((a) => a.type === 'cash')?.id ?? accounts[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  if (!pot) return null;
  if (!canManagePoolMoney(me, managerId)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Transfer pool money" onBack={() => router.back()} />
        <EmptyState icon="🔒" title="Not permitted" subtitle="Only the pool manager or a pot admin can transfer pool money." />
      </SafeAreaView>
    );
  }

  const submit = async () => {
    const paise = toPaise(parseFloat(amount) || 0);
    if (!fromId || !toId || fromId === toId) {
      setError('Choose two different pool accounts');
      return;
    }
    if (paise <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (paise > calculateAccountBalance(txs, fromId)) {
      setError('Not enough money in that pool account');
      return;
    }
    setSaving(true);
    try {
      await transferPoolMoney({
        potId: id,
        fromAccountId: fromId,
        toAccountId: toId,
        amount: paise,
        date: new Date().toISOString().slice(0, 10),
        note: note.trim() || undefined,
      });
      showToast('Money transferred');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transfer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Transfer pool money" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={{ color: colors.inkSoft, marginBottom: 8 }}>From · {formatMoney(calculateAccountBalance(txs, fromId))}</Text>
        <View style={styles.row}>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} selected={fromId === a.id} onPress={() => setFromId(a.id)} />
          ))}
        </View>
        <Text style={{ color: colors.inkSoft, marginVertical: 8 }}>To</Text>
        <View style={styles.row}>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} selected={toId === a.id} onPress={() => setToId(a.id)} />
          ))}
        </View>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="Amount ₹"
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface }]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note"
          style={[styles.input, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.surface }]}
        />
        {error ? <Text style={{ color: colors.neg, marginBottom: 8 }}>{error}</Text> : null}
        <PrimaryButton label={saving ? 'Transferring…' : 'Transfer'} onPress={submit} disabled={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 8 },
});
