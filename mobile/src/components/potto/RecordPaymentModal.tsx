import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountInput } from '@/components/potto/AmountInput';
import { Chip } from '@/components/potto/Chip';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from '@/constants/payment-methods';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { validateSettlementAmount } from '@/logic/accounting';
import type { PaymentMethod } from '@/types/models';
import { formatMoney, toPaise, toRupees } from '@/utils/money';

interface RecordPaymentModalProps {
  visible: boolean;
  fromName: string;
  toName: string;
  outstandingPaise: number;
  onCancel: () => void;
  onConfirm: (paidPaise: number, paymentMethod: PaymentMethod | undefined, note: string | undefined) => void;
}

export function RecordPaymentModal({
  visible,
  fromName,
  toName,
  outstandingPaise,
  onCancel,
  onConfirm,
}: RecordPaymentModalProps) {
  const colors = usePottoColors();
  // The parent remounts this component (via a changing `key`) each time a
  // different settlement is opened, so initial state can just read props once.
  const [amountText, setAmountText] = useState(() => String(toRupees(outstandingPaise)));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  const paidPaise = toPaise(parseFloat(amountText) || 0);
  const remaining = Math.max(outstandingPaise - paidPaise, 0);

  const confirm = () => {
    const result = validateSettlementAmount(outstandingPaise, paidPaise);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    onConfirm(paidPaise, paymentMethod, note.trim() || undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onCancel} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.ink }]}>Settlement</Text>
          <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
            {fromName} → {toName}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Amount owed</Text>
            <Text style={[styles.owed, { color: colors.ink }]}>{formatMoney(outstandingPaise)}</Text>

            <Text style={[styles.label, { color: colors.inkSoft, marginTop: 16 }]}>Amount paid</Text>
            <AmountInput
              value={amountText}
              onChangeText={(v) => {
                setAmountText(v);
                setError(undefined);
              }}
              autoFocus
            />

            <View style={[styles.remainingRow, { backgroundColor: colors.surfaceSunk }]}>
              <Text style={{ color: colors.inkSoft, fontSize: 13 }}>Remaining after payment</Text>
              <Text
                style={{
                  color: remaining === 0 && paidPaise > 0 && paidPaise <= outstandingPaise ? colors.pos : colors.ink,
                  fontSize: 15,
                  fontWeight: '700',
                }}>
                {formatMoney(remaining)}
              </Text>
            </View>

            {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}

            <Text style={[styles.label, { color: colors.inkSoft, marginTop: 16 }]}>Payment method (optional)</Text>
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

            <Text style={[styles.label, { color: colors.inkSoft, marginTop: 16 }]}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 14.5 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={confirm} style={[styles.btn, { backgroundColor: colors.ink }]}>
              <Text style={{ color: colors.paper, fontWeight: '600', fontSize: 14.5 }}>Confirm Payment</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,14,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backdropFill: { ...StyleSheet.absoluteFill },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '86%',
    borderRadius: Radius.lg,
    padding: 22,
  },
  scroll: { flexGrow: 0 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13.5, marginTop: 2, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  owed: { fontSize: 20, fontWeight: '700' },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 10,
  },
  error: { fontSize: 12.5, marginTop: 8, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { borderWidth: 1 },
});
