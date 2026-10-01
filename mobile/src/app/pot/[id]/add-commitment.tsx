import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { DatePickerField } from '@/components/potto/DatePickerField';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { CategoryPicker } from '@/components/categories/CategoryPicker';
import { usePottoColors } from '@/constants/potto-theme';
import { canCreateCommitment, canEditCommitment, canManageCategories } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { Commitment } from '@/types/models';
import { toPaise, toRupees } from '@/utils/money';

export default function AddCommitmentScreen() {
  const { id, editId } = useLocalSearchParams<{ id: string; editId?: string }>();
  const colors = usePottoColors();
  const { getPot, getCurrentMember, getCommitment } = usePottoStore();
  const pot = getPot(id);
  const me = getCurrentMember(id);
  const editingCommitment = editId ? getCommitment(id, editId) : undefined;

  if (!pot) return null;

  const allowed = editingCommitment ? canEditCommitment(me, editingCommitment) : canCreateCommitment(me);
  if (!allowed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Planned payment" onBack={() => router.back()} />
        <EmptyState icon="🔒" title="Not permitted" subtitle="You don't have permission to do this in this Pot." />
      </SafeAreaView>
    );
  }

  return <CommitmentForm potId={id} editingCommitment={editingCommitment} />;
}

function CommitmentForm({ potId, editingCommitment }: { potId: string; editingCommitment?: Commitment }) {
  const colors = usePottoColors();
  const isEdit = !!editingCommitment;
  const { createCommitment, updateCommitment, getCategories, getCurrentMember } = usePottoStore();
  const { showToast } = useToast();

  const [title, setTitle] = useState(editingCommitment?.title ?? '');
  const [vendorName, setVendorName] = useState(editingCommitment?.vendorName ?? '');
  const [categoryId, setCategoryId] = useState<string | undefined>(editingCommitment?.categoryId);
  const [description, setDescription] = useState(editingCommitment?.description ?? '');
  const [totalAmountText, setTotalAmountText] = useState(
    editingCommitment ? String(toRupees(editingCommitment.totalAmount)) : '',
  );
  const [hasDueDate, setHasDueDate] = useState(!!editingCommitment?.dueDate);
  const [dueDate, setDueDate] = useState(editingCommitment?.dueDate ?? new Date().toISOString().slice(0, 10));
  const [titleError, setTitleError] = useState<string | undefined>();
  const [amountError, setAmountError] = useState<string | undefined>();

  const submit = async () => {
    if (!title.trim()) {
      setTitleError('Enter a title');
      return;
    }
    setTitleError(undefined);
    const totalAmount = toPaise(parseFloat(totalAmountText) || 0);
    if (totalAmount <= 0) {
      setAmountError('Enter a total amount greater than zero');
      return;
    }
    setAmountError(undefined);

    const payload = {
      title: title.trim(),
      vendorName: vendorName.trim() || undefined,
      categoryId,
      description: description.trim() || undefined,
      totalAmount,
      dueDate: hasDueDate ? dueDate : undefined,
    };

    const result =
      isEdit && editingCommitment
        ? await updateCommitment(potId, editingCommitment.id, payload)
        : await createCommitment({ potId, ...payload });

    if (!result.ok) {
      setAmountError(result.reason);
      return;
    }
    showToast(isEdit ? 'Planned payment updated' : 'Planned payment added');
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title={isEdit ? 'Edit planned payment' : 'Add planned payment'} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Title">
            <TextInput
              value={title}
              onChangeText={(v) => { setTitle(v); if (v.trim()) setTitleError(undefined); }}
              placeholder="e.g. Hotel"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: titleError ? colors.neg : colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
            {!!titleError && <Text style={[styles.error, { color: colors.neg, marginTop: 5, marginBottom: 0 }]}>{titleError}</Text>}
          </Field>

          <Field label="Vendor (optional)">
            <TextInput
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="e.g. Sea View Resort"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          <Field label="Total amount">
            <View style={[styles.amountRow, { borderColor: amountError ? colors.neg : colors.line, backgroundColor: colors.surfaceSunk }]}>
              <Text style={{ color: colors.inkSoft, fontSize: 19, fontWeight: '600' }}>{'₹'}</Text>
              <TextInput
                value={totalAmountText}
                onChangeText={(v) => { setTotalAmountText(v.replace(/[^0-9.]/g, '')); setAmountError(undefined); }}
                placeholder="0"
                placeholderTextColor={colors.inkSoft}
                keyboardType="decimal-pad"
                style={[styles.amountInput, { color: colors.ink }]}
              />
            </View>
            {!!amountError && <Text style={[styles.error, { color: colors.neg }]}>{amountError}</Text>}
          </Field>

          <Field label="Category (optional)">
            <CategoryPicker
              potId={potId}
              categories={getCategories(potId)}
              selectedId={categoryId}
              onSelect={setCategoryId}
              canManage={canManageCategories(getCurrentMember(potId))}
            />
          </Field>

          <Field label="Due date">
            <View style={styles.chipRow}>
              <Chip label="No due date" selected={!hasDueDate} onPress={() => setHasDueDate(false)} />
              <Chip label="Set due date" selected={hasDueDate} onPress={() => setHasDueDate(true)} />
            </View>
            {hasDueDate && (
              <View style={{ marginTop: 10 }}>
                <DatePickerField value={dueDate} onChange={setDueDate} />
              </View>
            )}
          </Field>

          <Field label="Notes (optional)">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. 3 nights"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
          </Field>

          <View style={styles.actions}>
            <PrimaryButton label={isEdit ? 'Save Changes' : 'Save'} onPress={submit} fullWidth />
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
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '600', paddingVertical: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { fontSize: 12.5, marginTop: 6, marginBottom: 0, fontWeight: '600' },
  actions: { paddingTop: 8 },
});
