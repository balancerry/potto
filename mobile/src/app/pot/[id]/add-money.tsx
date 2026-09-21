import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmountInput } from '@/components/potto/AmountInput';
import { PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { DatePickerField } from '@/components/potto/DatePickerField';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { calculateExpenseShares } from '@/logic/accounting';
import { canAddMoney, canEditTransaction } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { Transaction } from '@/types/models';
import { formatMoney, toPaise, toRupees } from '@/utils/money';

type ContributionMode = 'same' | 'different';
type AmountMode = 'per_member' | 'total';

export default function AddMoneyScreen() {
  const { id, editId, amount, memberId } = useLocalSearchParams<{
    id: string;
    editId?: string;
    /** Prefill (rupees, as a string) — used by the Settle Up "Add ₹X" action. */
    amount?: string;
    /** Prefill — the single member preselected when arriving with `amount`. */
    memberId?: string;
  }>();
  const colors = usePottoColors();
  const { getPot, getCurrentMember, getTransactions } = usePottoStore();
  const pot = getPot(id);
  const me = getCurrentMember(id);
  const editingTx = editId ? getTransactions(id).find((t) => t.id === editId) : undefined;

  if (!pot) return null;

  const allowed = editingTx ? canEditTransaction(me, editingTx) : canAddMoney(me);
  if (!allowed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Add Money" onBack={() => router.back()} />
        <EmptyState icon="🔒" title="Not permitted" subtitle="You don't have permission to do this in this Pot." />
      </SafeAreaView>
    );
  }

  if (editingTx) {
    return <EditContributionForm potId={id} tx={editingTx} />;
  }

  return (
    <CreateContributionForm
      potId={id}
      defaultMemberId={memberId || me?.id}
      prefillAmount={amount}
    />
  );
}

// ---------------------------------------------------------------------------
// CREATE — multi-member contribution flow
// ---------------------------------------------------------------------------

function CreateContributionForm({
  potId,
  defaultMemberId,
  prefillAmount,
}: {
  potId: string;
  defaultMemberId?: string;
  /** Rupees, as a string (e.g. "700") — prefilled by the Settle Up "Add ₹X" action. */
  prefillAmount?: string;
}) {
  const colors = usePottoColors();
  const { getPot, addMoney } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(potId);

  const [amountText, setAmountText] = useState(prefillAmount ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultMemberId ? [defaultMemberId] : []);
  const [mode, setMode] = useState<ContributionMode>('same');
  const [amountMode, setAmountMode] = useState<AmountMode>('per_member');
  const [differentAmounts, setDifferentAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | undefined>();

  const allIds = useMemo(() => pot?.members.map((m) => m.id) ?? [], [pot]);
  const amountPaise = toPaise(parseFloat(amountText) || 0);
  const entries = useMemo(() => {
    if (mode === 'same') {
      if (amountMode === 'total') {
        return calculateExpenseShares(amountPaise, selectedIds);
      }
      return selectedIds.map((memberId) => ({ memberId, amount: amountPaise }));
    }
    return selectedIds.map((memberId) => ({
      memberId,
      amount: toPaise(parseFloat(differentAmounts[memberId] || '0') || 0),
    }));
  }, [mode, amountMode, amountPaise, selectedIds, differentAmounts]);

  if (!pot) return null;

  const allSelected = selectedIds.length === allIds.length;

  const toggleMember = (memberId: string) => {
    setError(undefined);
    setSelectedIds((prev) => (prev.includes(memberId) ? prev.filter((p) => p !== memberId) : [...prev, memberId]));
  };

  const toggleSelectAll = () => {
    setError(undefined);
    setSelectedIds(allSelected ? [] : allIds);
  };

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  const submit = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one member');
      return;
    }
    if (mode === 'same') {
      if (!amountText || amountPaise <= 0) {
        setError('Enter an amount greater than zero');
        return;
      }
    } else {
      const missing = selectedIds.some((memberId) => toPaise(parseFloat(differentAmounts[memberId] || '0') || 0) <= 0);
      if (missing) {
        setError('Enter an amount for every selected member');
        return;
      }
    }
    setError(undefined);
    try {
      await addMoney({
        potId,
        date,
        note: note.trim() || undefined,
        entries,
      });
      showToast(entries.length > 1 ? `${entries.length} contributions added` : 'Money added');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add money');
    }
  };

  const amountLabel = mode === 'same' ? (amountMode === 'total' ? 'Total amount' : 'Amount per member') : undefined;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Add Money" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {mode === 'same' && (
            <Field label={amountLabel!}>
              <AmountInput value={amountText} onChangeText={(v) => { setAmountText(v); setError(undefined); }} autoFocus />
              <View style={styles.amountModeRow}>
                <Chip label="Per member" selected={amountMode === 'per_member'} onPress={() => setAmountMode('per_member')} />
                <Chip label="Split a total equally" selected={amountMode === 'total'} onPress={() => setAmountMode('total')} />
              </View>
            </Field>
          )}

          <Field label="Who contributed?">
            <Pressable onPress={toggleSelectAll} style={[styles.memberRow, { borderBottomColor: colors.line }]}>
              <Checkbox checked={allSelected} />
              <Text style={[styles.memberName, { color: colors.ink, fontWeight: '700' }]}>Select all</Text>
              <Text style={{ color: colors.inkSoft, fontSize: 12.5 }}>
                {selectedIds.length} of {allIds.length}
              </Text>
            </Pressable>
            {pot.members.map((m) => {
              const selected = selectedIds.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  onPress={() => toggleMember(m.id)}
                  style={[styles.memberRow, { borderBottomColor: colors.line }]}>
                  <Checkbox checked={selected} />
                  <Text style={[styles.memberName, { color: colors.ink }]}>{m.name}</Text>
                  {selected && mode === 'different' && (
                    <TextInput
                      value={differentAmounts[m.id] ?? ''}
                      onChangeText={(v) => {
                        setError(undefined);
                        setDifferentAmounts((prev) => ({ ...prev, [m.id]: v.replace(/[^0-9.]/g, '') }));
                      }}
                      keyboardType="decimal-pad"
                      placeholder="₹0"
                      placeholderTextColor={colors.inkSoft}
                      style={[styles.shareInput, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
                    />
                  )}
                  {selected && mode === 'same' && (
                    <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                      {formatMoney(entries.find((e) => e.memberId === m.id)?.amount ?? 0)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </Field>

          <Field label="Contribution mode">
            <Pressable onPress={() => setMode('same')} style={styles.radioRow}>
              <Radio checked={mode === 'same'} />
              <Text style={[styles.radioLabel, { color: colors.ink }]}>Same amount per member</Text>
            </Pressable>
            <Pressable onPress={() => setMode('different')} style={styles.radioRow}>
              <Radio checked={mode === 'different'} />
              <Text style={[styles.radioLabel, { color: colors.ink }]}>Different amounts</Text>
            </Pressable>
          </Field>

          <Field label="Date">
            <DatePickerField value={date} onChange={setDate} />
          </Field>

          {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}

          <View style={[styles.summary, { backgroundColor: colors.surfaceSunk }]}>
            <Text style={[styles.summaryLine, { color: colors.inkSoft }]}>
              {selectedIds.length} member{selectedIds.length !== 1 ? 's' : ''} selected
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.inkSoft }]}>Total contribution</Text>
            <Text style={[styles.summaryTotal, { color: colors.ink }]}>{formatMoney(total)}</Text>
          </View>

          <Field label="Note (optional)">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Initial contribution"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          <View style={styles.actions}>
            <PrimaryButton label="Add Money" onPress={submit} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// EDIT — single contribution record
// ---------------------------------------------------------------------------

function EditContributionForm({ potId, tx }: { potId: string; tx: Transaction }) {
  const colors = usePottoColors();
  const { getPot, updateContribution } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(potId);

  const [amount, setAmount] = useState(String(toRupees(tx.amount)));
  const [memberId, setMemberId] = useState(tx.paidBy ?? '');
  const [date, setDate] = useState(tx.date);
  const [note, setNote] = useState(tx.note ?? '');
  const [error, setError] = useState<string | undefined>();

  if (!pot) return null;

  const submit = async () => {
    const paise = toPaise(parseFloat(amount) || 0);
    if (!amount || paise <= 0) {
      setError('Enter an amount greater than zero');
      return;
    }
    if (!memberId) {
      setError('Select a member');
      return;
    }
    try {
      await updateContribution(potId, tx.id, {
        memberId,
        amount: paise,
        date,
        note: note.trim() || undefined,
      });
      showToast('Changes saved');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Edit Contribution" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Amount">
            <AmountInput value={amount} onChangeText={(v) => { setAmount(v); setError(undefined); }} error={error} autoFocus />
          </Field>

          <Field label="Member">
            <View style={styles.amountModeRow}>
              {pot.members.map((m) => (
                <Chip key={m.id} label={m.name} selected={memberId === m.id} onPress={() => setMemberId(m.id)} />
              ))}
            </View>
          </Field>

          <Field label="Date">
            <DatePickerField value={date} onChange={setDate} />
          </Field>

          <Field label="Note (optional)">
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. Initial contribution"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          <View style={styles.actions}>
            <PrimaryButton label="Save Changes" onPress={submit} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = usePottoColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text>
      {children}
    </View>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  const colors = usePottoColors();
  return (
    <View
      style={[
        styles.checkbox,
        { borderColor: checked ? colors.accent : colors.line, backgroundColor: checked ? colors.accent : 'transparent' },
      ]}>
      {checked && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{'✓'}</Text>}
    </View>
  );
}

function Radio({ checked }: { checked: boolean }) {
  const colors = usePottoColors();
  return (
    <View style={[styles.radioOuter, { borderColor: checked ? colors.accent : colors.line }]}>
      {checked && <View style={[styles.radioInner, { backgroundColor: colors.accent }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 20 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  amountModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  memberName: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  shareInput: { width: 90, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, fontSize: 13.5, textAlign: 'right' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 14.5, fontWeight: '500' },
  error: { fontSize: 12.5, marginBottom: 12, fontWeight: '600' },
  summary: { borderRadius: Radius.md, padding: 16, marginBottom: 20 },
  summaryLine: { fontSize: 13, marginBottom: 8 },
  summaryLabel: { fontSize: 12.5 },
  summaryTotal: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  actions: { paddingTop: 8 },
});
