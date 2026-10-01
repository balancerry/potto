import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryGlyph } from '@/components/categories/CategoryIcon';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { categoriesForPicker, categoryColorHex, categoryTint } from '@/logic/categories';
import type { PotCategory } from '@/types/models';

/**
 * Single-select category picker for expense and upcoming-payment forms.
 * Shows the Pot's active categories, plus the record's own category when it has
 * been archived (selected, labelled "Archived"), so editing never silently
 * drops it. Tapping the selected category clears it (Uncategorized).
 */
export function CategoryPicker({
  potId,
  categories,
  selectedId,
  onSelect,
  canManage,
}: {
  potId: string;
  categories: PotCategory[];
  selectedId?: string;
  onSelect: (categoryId: string | undefined) => void;
  /** Show the "Customize" entry point (owner/admin only). */
  canManage: boolean;
}) {
  const colors = usePottoColors();
  const options = categoriesForPicker(categories, selectedId);
  const manage = () => router.push(`/pot/${potId}/categories`);

  if (options.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.surfaceSunk, borderColor: colors.line }]}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>No active categories</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
          {canManage
            ? "Create a category to organize this Pot's expenses. You can still save without one."
            : 'A pot admin can add categories. You can still save without one.'}
        </Text>
        {canManage && (
          <Pressable onPress={manage} accessibilityRole="button" style={styles.manageLink}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13.5 }}>+ Add category</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        {options.map((c) => {
          const selected = c.id === selectedId;
          const fg = categoryColorHex(c.color);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(selected ? undefined : c.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? categoryTint(c.color, '26') : colors.surface,
                  borderColor: selected ? fg : colors.line,
                },
              ]}>
              <CategoryGlyph icon={c.icon} color={c.isActive ? fg : colors.inkSoft} size={15} />
              <Text numberOfLines={1} style={{ color: selected ? colors.ink : colors.inkSoft, fontWeight: '600', fontSize: 13.5 }}>
                {c.name}
                {!c.isActive ? ' · Archived' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {canManage && (
        <Pressable onPress={manage} accessibilityRole="link" style={styles.customize}>
          <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Customize categories</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  customize: { marginTop: 10, alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  empty: { borderRadius: Radius.md, borderWidth: 1, padding: 14 },
  manageLink: { marginTop: 10, minHeight: 36, justifyContent: 'center' },
});
