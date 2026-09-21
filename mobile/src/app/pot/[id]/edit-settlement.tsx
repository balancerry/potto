import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/potto/AmountInput';
import { PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { DatePickerField } from '@/components/potto/DatePickerField';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '@/constants/payment-methods';
import { usePottoColors } from '@/constants/potto-theme';
import { validateSettlementParties } from '@/logic/accounting';
import { canEditTransaction } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { PaymentMethod } from '@/types/models';
import { toPaise, toRupees } from '@/utils/money';

export default function EditSettlementScreen() {
  const { id, txId } = useLocalSearchParams<{ id: string; txId: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCurrentMember, updateSettlement } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const me = getCurrentMember(id);
  const tx = getTransactions(id).find((t) => t.id === txId);

  const [fromMemberId, setFromMemberId] = useState(tx?.paidBy ?? '');
  const [toMemberId, setToMemberId] = useState(tx?.toMember ?? '');
  const [amount, setAmount] = useState(tx ? String(toRupees(tx.amount)) : '');
  const [date, setDate] = useState(tx?.date ?? new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(tx?.paymentMethod);
  const [note, setNote] = useState(tx?.note ?? '');
  const [error, setError] = useState<string | undefined>();

  if (!pot || !tx) return null;

  if (!canEditTransaction(me, tx)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Edit Settlement" onBack={() => router.back()} />
        <EmptyState icon="🔒" title="Not permitted" subtitle="You don't have permission to do this in this Pot." />
      </SafeAreaView>
    );
  }

  const amountPaise = toPaise(parseFloat(amount) || 0);

  const submit = async () => {
    const parties = validateSettlementParties(pot.members, fromMemberId, toMemberId);
    if (!parties.valid) {
      setError(parties.error);
      return;
    }
    if (!amount || amountPaise <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    setError(undefined);

    try {
      await updateSettlement(id, tx.id, {
        fromMemberId,
        toMemberId,
        amount: amountPaise,
        date,
        paymentMethod,
        note: note.trim() || undefined,
      });
      showToast('Settlement updated');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settlement');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Edit Settlement" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="From (payer)">
            <View style={styles.chipRow}>
              {pot.members.map((m) => (
                <Chip key={m.id} label={m.name} selected={fromMemberId === m.id} onPress={() => { setFromMemberId(m.id); setError(undefined); }} />
              ))}
            </View>
          </Field>

          <Field label="To (recipient)">
            <View style={styles.chipRow}>
              {pot.members.map((m) => (
                <Chip key={m.id} label={m.name} selected={toMemberId === m.id} onPress={() => { setToMemberId(m.id); setError(undefined); }} />
              ))}
            </View>
          </Field>

          <Field label="Amount">
            <AmountInput value={amount} onChangeText={(v) => { setAmount(v); setError(undefined); }} />
          </Field>

          <Field label="Date">
            <DatePickerField value={date} onChange={setDate} />
          </Field>

          <Field label="Payment method (optional)">
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map((m) => (
                <Chip
                  key={m}
                  label={PAYMENT_METHOD_LABEL[m]}
                  selected={paymentMethod === m}
                  onPress={() => setPaymentMethod(paymentMethod === m ? undefined : m)}
                />
              ))}
            </View>
          </Field>

          <Field label="Note (optional)">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}

          <View style={styles.actions}>
            <PrimaryButton label="Save Changes" onPress={submit} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = usePottoColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 16 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 12.5, marginBottom: 12, fontWeight: '600' },
  actions: { paddingTop: 8 },
});
