import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/potto/AmountInput';
import { PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { CommitmentLinkSection, type CommitmentLinkResult } from '@/components/potto/CommitmentLinkSection';
import { DatePickerField } from '@/components/potto/DatePickerField';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { SplitSelector } from '@/components/potto/SplitSelector';
import { EXPENSE_CATEGORIES } from '@/constants/categories';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { deriveCommitmentStatus, calculateCommitmentPaid } from '@/logic/commitments';
import { canAddExpense, canEditTransaction } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { Commitment, CommitmentPayment, PaymentSource, Pot, Split, SplitMethod, Transaction } from '@/types/models';
import { formatMoney, toPaise, toRupees } from '@/utils/money';

const CATEGORIES = EXPENSE_CATEGORIES;

export default function AddExpenseScreen() {
  const { id, editId, linkCommitmentId } = useLocalSearchParams<{ id: string; editId?: string; linkCommitmentId?: string }>();
  const colors = usePottoColors();
  const { getPot, getCurrentMember, getTransactions, getCommitments, getCommitmentPayments } = usePottoStore();
  const pot = getPot(id);
  const me = getCurrentMember(id);
  const editingTx = editId ? getTransactions(id).find((t) => t.id === editId) : undefined;

  if (!pot) return null;

  const allowed = editingTx ? canEditTransaction(me, editingTx) : canAddExpense(me);
  if (!allowed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Add Expense" onBack={() => router.back()} />
        <EmptyState icon="🔒" title="Not permitted" subtitle="You don't have permission to do this in this Pot." />
      </SafeAreaView>
    );
  }

  const allCommitments = getCommitments(id);
  const commitmentPayments = allCommitments.flatMap((c) => getCommitmentPayments(id, c.id));
  const transactions = getTransactions(id);
  // Only planned/partially_paid commitments in THIS pot can receive a new payment — cancelled and fully-paid ones are excluded, and cross-Pot linking is impossible since getCommitments is already scoped to this potId.
  const linkableCommitments = allCommitments.filter((c) => {
    const status = deriveCommitmentStatus(c, calculateCommitmentPaid(c.id, commitmentPayments, transactions));
    return status === 'planned' || status === 'partially_paid';
  });

  return (
    <ExpenseForm
      potId={id}
      pot={pot}
      defaultMemberId={me?.id}
      editingTx={editingTx}
      linkableCommitments={linkableCommitments}
      commitmentPayments={commitmentPayments}
      transactions={transactions}
      forcedCommitmentId={linkCommitmentId}
    />
  );
}

function ExpenseForm({
  potId,
  pot,
  defaultMemberId,
  editingTx,
  linkableCommitments,
  commitmentPayments,
  transactions,
  forcedCommitmentId,
}: {
  potId: string;
  pot: Pot;
  defaultMemberId?: string;
  editingTx?: Transaction;
  linkableCommitments: Commitment[];
  commitmentPayments: CommitmentPayment[];
  transactions: Transaction[];
  forcedCommitmentId?: string;
}) {
  const colors = usePottoColors();
  const { addExpense, updateExpense, addCommitmentPayment, createCommitmentWithPayment } = usePottoStore();
  const { showToast } = useToast();
  const isEdit = !!editingTx;

  const [description, setDescription] = useState(editingTx?.description ?? '');
  const [amount, setAmount] = useState(editingTx ? String(toRupees(editingTx.amount)) : '');
  const [paidBy, setPaidBy] = useState(editingTx?.paidBy ?? defaultMemberId ?? pot.members[0]?.id ?? '');
  const [source, setSource] = useState<PaymentSource>(editingTx?.paymentSource ?? 'pool');
  const [category, setCategory] = useState<string | undefined>(editingTx?.category);
  const [note, setNote] = useState(editingTx?.note ?? '');
  const [date, setDate] = useState(editingTx?.date ?? new Date().toISOString().slice(0, 10));
  const [participantIds, setParticipantIds] = useState<string[]>(
    editingTx?.participants ?? pot.members.map((m) => m.id),
  );
  const [method, setMethod] = useState<SplitMethod>(editingTx?.splitMethod ?? 'equal');
  const [splits, setSplits] = useState<Split[]>(editingTx?.splits ?? []);
  const [splitValid, setSplitValid] = useState(true);
  const [splitError, setSplitError] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();
  const [descriptionError, setDescriptionError] = useState<string | undefined>();
  const [commitmentLink, setCommitmentLink] = useState<CommitmentLinkResult>({ mode: 'none' });
  const [commitmentLinkValid, setCommitmentLinkValid] = useState(true);
  const [commitmentLinkError, setCommitmentLinkError] = useState<string | undefined>();

  const initialCustomText =
    editingTx?.splitMethod === 'custom'
      ? Object.fromEntries((editingTx.splits ?? []).map((s) => [s.memberId, String(toRupees(s.amount))]))
      : undefined;
  const initialPercentText =
    editingTx?.splitMethod === 'percentage'
      ? Object.fromEntries(
          (editingTx.splits ?? []).map((s) => [s.memberId, String(Math.round((s.amount / editingTx.amount) * 10000) / 100)]),
        )
      : undefined;

  const amountPaise = toPaise(parseFloat(amount) || 0);

  const submit = async () => {
    if (!description.trim()) {
      setDescriptionError('Enter a description');
      return;
    }
    setDescriptionError(undefined);
    if (!amount || amountPaise <= 0) {
      setAmountError('Enter an amount greater than zero');
      return;
    }
    if (participantIds.length === 0) {
      setSplitError('Select at least one participant');
      return;
    }
    if (!splitValid) return;
    if (!isEdit && commitmentLink.mode !== 'none' && !commitmentLinkValid) return;

    const payload = {
      description: description.trim(),
      amount: amountPaise,
      paidBy,
      paymentSource: source,
      date,
      category,
      participants: participantIds,
      splitMethod: method,
      splits,
      note: note.trim() || undefined,
    };

    if (isEdit && editingTx) {
      try {
        await updateExpense(potId, editingTx.id, payload);
        showToast('Changes saved');
        router.back();
      } catch (err) {
        setAmountError(err instanceof Error ? err.message : 'Could not save changes');
      }
      return;
    }

    if (commitmentLink.mode === 'link') {
      const result = await addCommitmentPayment({ potId, commitmentId: commitmentLink.commitmentId, ...payload });
      if (!result.ok) {
        setCommitmentLinkError(result.reason);
        return;
      }
      showToast('Payment saved');
      router.back();
      return;
    }

    if (commitmentLink.mode === 'create') {
      const result = await createCommitmentWithPayment({
        potId,
        commitment: {
          title: commitmentLink.title,
          vendorName: commitmentLink.vendorName,
          category: commitmentLink.category,
          totalAmount: commitmentLink.totalAmount,
          dueDate: commitmentLink.dueDate,
        },
        payment: payload,
      });
      if (!result.ok) {
        setCommitmentLinkError(result.reason);
        return;
      }
      showToast('Upcoming Payment created and payment saved');
      router.back();
      return;
    }

    try {
      await addExpense({ potId, ...payload });
      showToast('Expense saved');
      router.back();
    } catch (err) {
      setAmountError(err instanceof Error ? err.message : 'Could not save expense');
    }
  };

  const paidByName = pot.members.find((m) => m.id === paidBy)?.name ?? '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title={isEdit ? 'Edit Expense' : 'Add Expense'} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Description">
            <TextInput
              value={description}
              onChangeText={(v) => { setDescription(v); if (v.trim()) setDescriptionError(undefined); }}
              placeholder="e.g. Dinner"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: descriptionError ? colors.neg : colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
            {!!descriptionError && <Text style={[styles.error, { color: colors.neg, marginTop: 5, marginBottom: 0 }]}>{descriptionError}</Text>}
          </Field>

          <Field label="Amount">
            <AmountInput value={amount} onChangeText={(v) => { setAmount(v); setAmountError(undefined); }} error={amountError} />
          </Field>

          <Field label="Paid by">
            <View style={styles.chipRow}>
              {pot.members.map((m) => (
                <Chip key={m.id} label={m.name} selected={paidBy === m.id} onPress={() => setPaidBy(m.id)} />
              ))}
            </View>
          </Field>

          <Field label="Payment source">
            <View style={styles.chipRow}>
              <Chip label="Shared Pot" selected={source === 'pool'} onPress={() => setSource('pool')} />
              <Chip label="Personally" selected={source === 'personal'} onPress={() => setSource('personal')} />
            </View>
          </Field>

          <Field label="Category (optional)">
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? undefined : c)} />
              ))}
            </View>
          </Field>

          {!isEdit && (
            <View style={styles.field}>
              <CommitmentLinkSection
                commitments={linkableCommitments}
                payments={commitmentPayments}
                transactions={transactions}
                amountPaise={amountPaise}
                defaultTitle={description}
                defaultCategory={category}
                forcedCommitmentId={forcedCommitmentId}
                onResultChange={(result, valid, error) => {
                  setCommitmentLink(result);
                  setCommitmentLinkValid(valid);
                  setCommitmentLinkError(error);
                }}
              />
              {!!commitmentLinkError && <Text style={[styles.error, { color: colors.neg, marginTop: 8 }]}>{commitmentLinkError}</Text>}
            </View>
          )}

          <Field label="Date">
            <DatePickerField value={date} onChange={setDate} />
          </Field>

          <SplitSelector
            members={pot.members}
            amountPaise={amountPaise}
            method={method}
            onMethodChange={setMethod}
            participantIds={participantIds}
            onParticipantsChange={(ids) => { setParticipantIds(ids); setSplitError(undefined); }}
            onSplitsChange={(s, valid, err) => { setSplits(s); setSplitValid(valid); setSplitError(err); }}
            initialCustomText={initialCustomText}
            initialPercentText={initialPercentText}
          />
          {!!splitError && <Text style={[styles.error, { color: colors.neg }]}>{splitError}</Text>}

          {amountPaise > 0 && splits.length > 0 && (
            <View style={[styles.summary, { backgroundColor: colors.surfaceSunk }]}>
              <Text style={[styles.summaryTitle, { color: colors.ink }]}>{description || 'Expense'}</Text>
              <Text style={[styles.summaryAmt, { color: colors.ink }]}>{formatMoney(amountPaise)}</Text>
              <Text style={[styles.summarySub, { color: colors.inkSoft }]}>Paid by {paidByName}</Text>
              {splits.map((s) => (
                <View key={s.memberId} style={styles.summaryRow}>
                  <Text style={{ color: colors.ink, fontSize: 13.5 }}>{pot.members.find((m) => m.id === s.memberId)?.name}</Text>
                  <Text style={{ color: colors.inkSoft, fontSize: 13.5 }}>{formatMoney(s.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          <Field label="Note (optional)">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          <View style={styles.actions}>
            <PrimaryButton label={isEdit ? 'Save Changes' : 'Save Expense'} onPress={submit} fullWidth />
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
  error: { fontSize: 12.5, marginTop: -8, marginBottom: 12, fontWeight: '600' },
  summary: { borderRadius: Radius.md, padding: 16, marginTop: 6, marginBottom: 16 },
  summaryTitle: { fontSize: 15, fontWeight: '600' },
  summaryAmt: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  summarySub: { fontSize: 12.5, marginTop: 2, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  actions: { paddingTop: 8 },
});
