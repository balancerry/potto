import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryGlyph } from '@/components/categories/CategoryIcon';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NONE,
  categoryColorHex,
  type CategoryFilterValue,
} from '@/logic/categories';
import type { PotCategory } from '@/types/models';

/**
 * "All categories" dropdown for Activity. `options` is already the right set
 * (active categories plus archived ones still used by history); archived ones
 * are labelled so the list stays honest.
 */
export function CategoryFilter({
  options,
  value,
  onChange,
}: {
  options: PotCategory[];
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
}) {
  const colors = usePottoColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((c) => c.id === value);
  const label =
    value === CATEGORY_FILTER_ALL
      ? 'All categories'
      : value === CATEGORY_FILTER_NONE
        ? 'Uncategorized'
        : selected
          ? `${selected.name}${selected.isActive ? '' : ' · Archived'}`
          : 'All categories';
  const active = value !== CATEGORY_FILTER_ALL;

  const pick = (next: CategoryFilterValue) => {
    setOpen(false);
    onChange(next);
  };

  const renderRow = (id: CategoryFilterValue, text: string, icon?: string, color?: string, muted?: boolean) => (
    <Pressable
      key={id}
      onPress={() => pick(id)}
      accessibilityRole="button"
      accessibilityState={{ selected: id === value }}
      style={[styles.item, { borderBottomColor: colors.line }]}>
      <View style={styles.itemIcon}>{icon ? <CategoryGlyph icon={icon} color={muted ? colors.inkSoft : categoryColorHex(color ?? 'gray')} size={16} /> : null}</View>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: id === value ? '700' : '500', flex: 1 }}>{text}</Text>
      {id === value && <Text style={{ color: colors.accent, fontWeight: '700' }}>{'✓'}</Text>}
    </Pressable>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Category filter: ${label}`}
        style={[styles.trigger, { borderColor: active ? colors.ink : colors.line, backgroundColor: active ? colors.ink : colors.surface }]}>
        <Text numberOfLines={1} style={{ color: active ? colors.paper : colors.inkSoft, fontWeight: '600', fontSize: 13.5, maxWidth: 200 }}>
          {label}
        </Text>
        <ChevronDown size={15} color={active ? colors.paper : colors.inkSoft} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <ScrollView bounces={false}>
              {renderRow(CATEGORY_FILTER_ALL, 'All categories')}
              {options.map((c) => renderRow(c.id, c.isActive ? c.name : `${c.name} · Archived`, c.icon, c.color, !c.isActive))}
              {renderRow(CATEGORY_FILTER_NONE, 'Uncategorized', 'tag', undefined, true)}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,18,14,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, maxHeight: '70%', borderRadius: Radius.lg, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  itemIcon: { width: 18, alignItems: 'center' },
});
