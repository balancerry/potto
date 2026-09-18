import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '@/components/potto/Chip';
import {
  calculateCustomShares,
  calculateExpenseShares,
  calculatePercentageShares,
  validateSplit,
} from '@/logic/accounting';
import { usePottoColors } from '@/constants/potto-theme';
import type { Member, Split, SplitMethod } from '@/types/models';
import { formatMoney, toPaise } from '@/utils/money';

interface SplitSelectorProps {
  members: Member[];
  amountPaise: number;
  method: SplitMethod;
  onMethodChange: (m: SplitMethod) => void;
  participantIds: string[];
  onParticipantsChange: (ids: string[]) => void;
  onSplitsChange: (splits: Split[], valid: boolean, error?: string) => void;
  initialCustomText?: Record<string, string>;
  initialPercentText?: Record<string, string>;
}

export function SplitSelector({
  members,
  amountPaise,
  method,
  onMethodChange,
  participantIds,
  onParticipantsChange,
  onSplitsChange,
  initialCustomText,
  initialPercentText,
}: SplitSelectorProps) {
  const colors = usePottoColors();
  const [customText, setCustomText] = useState<Record<string, string>>(initialCustomText ?? {});
  const [pctText, setPctText] = useState<Record<string, string>>(initialPercentText ?? {});

  const toggleParticipant = (id: string) => {
    if (participantIds.includes(id)) onParticipantsChange(participantIds.filter((p) => p !== id));
    else onParticipantsChange([...participantIds, id]);
  };

  const participants = useMemo(() => members.filter((m) => participantIds.includes(m.id)), [members, participantIds]);

  useEffect(() => {
    if (method === 'equal') {
      const splits = calculateExpenseShares(amountPaise, participantIds);
      const v = validateSplit(amountPaise, method, splits);
      onSplitsChange(splits, v.valid, v.error);
      return;
    }
    if (method === 'custom') {
      const amounts: Record<string, number> = {};
      participants.forEach((m) => {
        amounts[m.id] = toPaise(parseFloat(customText[m.id] || '0') || 0);
      });
      const splits = calculateCustomShares(amounts);
      const v = validateSplit(amountPaise, method, splits);
      onSplitsChange(splits, v.valid, v.error);
      return;
    }
    if (method === 'percentage') {
      const pcts: Record<string, number> = {};
      participants.forEach((m) => {
        pcts[m.id] = parseFloat(pctText[m.id] || '0') || 0;
      });
      const splits = calculatePercentageShares(amountPaise, pcts);
      const v = validateSplit(amountPaise, method, splits, pcts);
      onSplitsChange(splits, v.valid, v.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, amountPaise, participantIds, customText, pctText]);

  return (
    <View>
      <Text style={[styles.label, { color: colors.inkSoft }]}>Participants</Text>
      <View style={styles.membersList}>
        {members.map((m) => {
          const selected = participantIds.includes(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => toggleParticipant(m.id)}
              style={[styles.memberRow, { borderBottomColor: colors.line }]}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: selected ? colors.accent : colors.line,
                    backgroundColor: selected ? colors.accent : 'transparent',
                  },
                ]}>
                {selected && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{'✓'}</Text>}
              </View>
              <Text style={[styles.memberName, { color: colors.ink }]}>{m.name}</Text>
              {selected && method === 'custom' && (
                <TextInput
                  value={customText[m.id] ?? ''}
                  onChangeText={(v) => setCustomText((prev) => ({ ...prev, [m.id]: v.replace(/[^0-9.]/g, '') }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.inkSoft}
                  style={[styles.shareInput, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
                />
              )}
              {selected && method === 'percentage' && (
                <TextInput
                  value={pctText[m.id] ?? ''}
                  onChangeText={(v) => setPctText((prev) => ({ ...prev, [m.id]: v.replace(/[^0-9.]/g, '') }))}
                  keyboardType="decimal-pad"
                  placeholder="0%"
                  placeholderTextColor={colors.inkSoft}
                  style={[styles.shareInput, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
                />
              )}
              {selected && method === 'equal' && participants.length > 0 && (
                <Text style={{ color: colors.inkSoft, fontSize: 13 }}>
                  {formatMoney(calculateExpenseShares(amountPaise, participantIds).find((s) => s.memberId === m.id)?.amount ?? 0)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.inkSoft, marginTop: 18 }]}>Split method</Text>
      <View style={styles.chipRow}>
        <Chip label="Equal" selected={method === 'equal'} onPress={() => onMethodChange('equal')} />
        <Chip label="Custom" selected={method === 'custom'} onPress={() => onMethodChange('custom')} />
        <Chip label="Percentage" selected={method === 'percentage'} onPress={() => onMethodChange('percentage')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  membersList: { marginBottom: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  memberName: { flex: 1, fontSize: 14.5, fontWeight: '500' },
  shareInput: { width: 80, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, fontSize: 13.5, textAlign: 'right' },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
