import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/potto/Chip';
import { DatePickerField } from '@/components/potto/DatePickerField';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import {
  calculateCommitmentPaid,
  calculateCommitmentRemaining,
  validateCommitmentPaymentAmount,
  validateCommitmentTotalAmount,
} from '@/logic/commitments';
import type { Commitment, CommitmentPayment, Transaction } from '@/types/models';
import { formatMoney, toPaise } from '@/utils/money';

export type CommitmentLinkResult =
  | { mode: 'none' }
  | { mode: 'link'; commitmentId: string }
  | { mode: 'create'; title: string; vendorName?: string; category?: string; totalAmount: number; dueDate?: string };

interface CommitmentLinkSectionProps {
  /** Candidates to link to — caller filters to this Pot's non-cancelled, not-yet-fully-paid commitments. */
  commitments: Commitment[];
  payments: CommitmentPayment[];
  transactions: Transaction[];
  /** The expense amount currently entered on the form, used to validate against each candidate's remaining. */
  amountPaise: number;
  defaultTitle?: string;
  defaultCategory?: string;
  /** When set (e.g. arriving from a Commitment's "Add Payment" button), locks to Link mode with this commitment and hides the mode picker. */
  forcedCommitmentId?: string;
  onResultChange: (result: CommitmentLinkResult, valid: boolean, error?: string) => void;
}

export function CommitmentLinkSection({
  commitments,
  payments,
  transactions,
  amountPaise,
  defaultTitle,
  defaultCategory,
  forcedCommitmentId,
  onResultChange,
}: CommitmentLinkSectionProps) {
  const colors = usePottoColors();
  const [mode, setMode] = useState<'none' | 'link' | 'create'>(forcedCommitmentId ? 'link' : 'none');
  const [selectedId, setSelectedId] = useState<string | undefined>(forcedCommitmentId);
  const [title, setTitle] = useState(defaultTitle ?? '');
  const [vendorName, setVendorName] = useState('');
  const [totalAmountText, setTotalAmountText] = useState('');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  const totalAmountPaise = toPaise(parseFloat(totalAmountText) || 0);
  const forcedCommitment = forcedCommitmentId ? commitments.find((c) => c.id === forcedCommitmentId) : undefined;
  const selectedCommitment = selectedId ? commitments.find((c) => c.id === selectedId) : undefined;

  useEffect(() => {
    if (mode === 'none') {
      onResultChange({ mode: 'none' }, true);
      return;
    }
    if (mode === 'link') {
      if (!selectedCommitment) {
        onResultChange({ mode: 'link', commitmentId: '' }, false, 'Select an Upcoming Payment to link');
        return;
      }
      const remaining = calculateCommitmentRemaining(selectedCommitment, payments, transactions);
      const check = validateCommitmentPaymentAmount(remaining, amountPaise);
      onResultChange({ mode: 'link', commitmentId: selectedCommitment.id }, check.valid, check.error);
      return;
    }
    // create
    if (!vendorName.trim()) {
      onResultChange(
        { mode: 'create', title: title.trim(), vendorName: vendorName.trim(), totalAmount: totalAmountPaise, dueDate: hasDueDate ? dueDate : undefined },
        false,
        'Enter a vendor name',
      );
      return;
    }
    const totalCheck = validateCommitmentTotalAmount(totalAmountPaise);
    if (!totalCheck.valid) {
      onResultChange(
        { mode: 'create', title: title.trim(), vendorName: vendorName.trim(), totalAmount: totalAmountPaise, dueDate: hasDueDate ? dueDate : undefined },
        false,
        totalCheck.error,
      );
      return;
    }
    const paymentCheck = validateCommitmentPaymentAmount(totalAmountPaise, amountPaise);
    onResultChange(
      {
        mode: 'create',
        title: title.trim() || vendorName.trim(),
        vendorName: vendorName.trim(),
        category: defaultCategory,
        totalAmount: totalAmountPaise,
        dueDate: hasDueDate ? dueDate : undefined,
      },
      paymentCheck.valid,
      paymentCheck.error,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedId, title, vendorName, totalAmountText, hasDueDate, dueDate, amountPaise]);

  const linkable = commitments.filter((c) => c.id !== forcedCommitmentId);

  return (
    <View>
      <Text style={[styles.label, { color: colors.inkSoft }]}>Related Upcoming Payment?</Text>

      {forcedCommitment ? (
        <CommitmentPreviewCard commitment={forcedCommitment} payments={payments} transactions={transactions} />
      ) : (
        <>
          <View style={styles.chipRow}>
            <Chip label="No" selected={mode === 'none'} onPress={() => setMode('none')} />
            <Chip label="Link Existing" selected={mode === 'link'} onPress={() => setMode('link')} />
            <Chip label="Create New" selected={mode === 'create'} onPress={() => setMode('create')} />
          </View>

          {mode === 'link' && (
            <View style={styles.pickList}>
              {linkable.length === 0 ? (
                <Text style={[styles.empty, { color: colors.inkSoft }]}>No Upcoming Payments available to link in this Pot yet.</Text>
              ) : (
                linkable.map((c) => {
                  const paid = calculateCommitmentPaid(c.id, payments, transactions);
                  const remaining = calculateCommitmentRemaining(c, payments, transactions);
                  const selected = selectedId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedId(c.id)}
                      style={[
                        styles.pickRow,
                        { borderColor: selected ? colors.accent : colors.line, backgroundColor: selected ? colors.accentSoft : colors.surfaceSunk },
                      ]}>
                      <View style={styles.flex1}>
                        <Text style={[styles.pickTitle, { color: colors.ink }]} numberOfLines={1}>
                          {c.vendorName || c.title}
                        </Text>
                        <Text style={[styles.pickSub, { color: colors.inkSoft }]}>
                          {formatMoney(c.totalAmount)} total · {formatMoney(remaining)} remaining
                        </Text>
                      </View>
                      {paid > 0 && (
                        <Text style={{ color: colors.pos, fontSize: 12, fontWeight: '600' }}>{formatMoney(paid)} paid</Text>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          {mode === 'create' && (
            <View style={styles.createBlock}>
              <TextInput
                value={vendorName}
                onChangeText={setVendorName}
                placeholder="Vendor (e.g. Sea View Resort)"
                placeholderTextColor={colors.inkSoft}
                style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
              />
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title (optional, e.g. Hotel)"
                placeholderTextColor={colors.inkSoft}
                style={[styles.input, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink, marginTop: 8 }]}
              />
              <View style={[styles.amountRow, { borderColor: colors.line, backgroundColor: colors.surfaceSunk }]}>
                <Text style={{ color: colors.inkSoft, fontSize: 15, fontWeight: '600' }}>{'₹'}</Text>
                <TextInput
                  value={totalAmountText}
                  onChangeText={(v) => setTotalAmountText(v.replace(/[^0-9.]/g, ''))}
                  placeholder="Total agreed amount"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="decimal-pad"
                  style={[styles.amountInput, { color: colors.ink }]}
                />
              </View>
              <View style={[styles.chipRow, { marginTop: 8 }]}>
                <Chip label="No due date" selected={!hasDueDate} onPress={() => setHasDueDate(false)} />
                <Chip label="Set due date" selected={hasDueDate} onPress={() => setHasDueDate(true)} />
              </View>
              {hasDueDate && (
                <View style={{ marginTop: 8 }}>
                  <DatePickerField value={dueDate} onChange={setDueDate} />
                </View>
              )}
              {amountPaise > 0 && (
                <Text style={[styles.hint, { color: colors.inkSoft }]}>
                  This expense ({formatMoney(amountPaise)}) will count as the first payment toward this new Upcoming Payment.
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function CommitmentPreviewCard({
  commitment,
  payments,
  transactions,
}: {
  commitment: Commitment;
  payments: CommitmentPayment[];
  transactions: Transaction[];
}) {
  const colors = usePottoColors();
  const remaining = calculateCommitmentRemaining(commitment, payments, transactions);
  return (
    <View style={[styles.previewCard, { backgroundColor: colors.surfaceSunk, borderColor: colors.line }]}>
      <Text style={[styles.pickTitle, { color: colors.ink }]}>{commitment.vendorName || commitment.title}</Text>
      <Text style={[styles.pickSub, { color: colors.inkSoft }]}>
        {formatMoney(commitment.totalAmount)} total · {formatMoney(remaining)} remaining
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, color: '#6B6862' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickList: { marginTop: 10, gap: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, borderWidth: 1, padding: 12 },
  flex1: { flex: 1, minWidth: 0 },
  pickTitle: { fontSize: 14.5, fontWeight: '600' },
  pickSub: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 13, paddingVertical: 8 },
  createBlock: { marginTop: 10 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, marginTop: 8 },
  amountInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  previewCard: { borderRadius: Radius.md, borderWidth: 1, padding: 12 },
});
