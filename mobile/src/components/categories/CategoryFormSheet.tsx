import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryGlyph } from '@/components/categories/CategoryIcon';
import { PrimaryButton, Button } from '@/components/potto/Button';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import {
  CATEGORY_COLORS,
  CATEGORY_ICON_IDS,
  CATEGORY_NAME_MAX_LENGTH,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  categoryColorHex,
  categoryTint,
} from '@/logic/categories';
import type { PotCategory } from '@/types/models';

/**
 * Bottom-sheet form to create or edit a category: name, icon (controlled
 * catalog), color (controlled palette). `onSubmit` resolves to an error string
 * to show inline, or undefined on success (the sheet then closes).
 */
export function CategoryFormSheet({
  visible,
  category,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  /** Present when editing. */
  category?: PotCategory;
  onClose: () => void;
  onSubmit: (value: { name: string; icon: string; color: string }) => Promise<string | undefined>;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Mounted only while open and keyed by category, so each open starts from that category's values. */}
      {visible && <CategoryForm key={category?.id ?? 'new'} category={category} onClose={onClose} onSubmit={onSubmit} />}
    </Modal>
  );
}

function CategoryForm({
  category,
  onClose,
  onSubmit,
}: {
  category?: PotCategory;
  onClose: () => void;
  onSubmit: (value: { name: string; icon: string; color: string }) => Promise<string | undefined>;
}) {
  const colors = usePottoColors();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState<string>(category?.icon ?? DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState<string>(category?.color ?? DEFAULT_CATEGORY_COLOR);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const err = await onSubmit({ name, icon, color });
    setSaving(false);
    if (err) setError(err);
    else onClose();
  };

  const fg = categoryColorHex(color);

  return (
    <>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.grabber, { backgroundColor: colors.line }]} />
          <Text style={[styles.title, { color: colors.ink }]}>{category ? 'Edit category' : 'Create category'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(undefined);
              }}
              placeholder="e.g. Beach Activities"
              placeholderTextColor={colors.inkSoft}
              maxLength={CATEGORY_NAME_MAX_LENGTH}
              autoFocus={!category}
              returnKeyType="done"
              style={[styles.input, { borderColor: error ? colors.neg : colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
            {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}

            <Text style={[styles.label, { color: colors.inkSoft }]}>Icon</Text>
            <View style={styles.grid}>
              {CATEGORY_ICON_IDS.map((id) => {
                const selected = id === icon;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={`Icon ${id}`}
                    accessibilityState={{ selected }}
                    onPress={() => setIcon(id)}
                    style={[
                      styles.iconCell,
                      {
                        borderColor: selected ? fg : colors.line,
                        backgroundColor: selected ? categoryTint(color, '26') : colors.surface,
                      },
                    ]}>
                    <CategoryGlyph icon={id} color={selected ? fg : colors.inkSoft} size={20} />
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.inkSoft }]}>Color</Text>
            <View style={styles.grid}>
              {CATEGORY_COLORS.map((c) => {
                const selected = c.id === color;
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={c.label}
                    accessibilityState={{ selected }}
                    onPress={() => setColor(c.id)}
                    style={[styles.swatchOuter, { borderColor: selected ? c.fg : 'transparent' }]}>
                    <View style={[styles.swatch, { backgroundColor: c.fg }]} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button label="Cancel" variant="secondary" onPress={onClose} fullWidth />
            </View>
            <View style={styles.flex}>
              <PrimaryButton
                label={category ? 'Save changes' : 'Create category'}
                onPress={submit}
                loading={saving}
                disabled={!name.trim()}
                fullWidth
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,18,14,0.45)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 12.5, fontWeight: '600', marginTop: 14, marginBottom: 8 },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, fontSize: 15 },
  error: { fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  swatchOuter: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
});
