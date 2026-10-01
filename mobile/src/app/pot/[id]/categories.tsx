import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryFormSheet } from '@/components/categories/CategoryFormSheet';
import { CategoryIcon } from '@/components/categories/CategoryIcon';
import { ActionMenu, type ActionMenuItem } from '@/components/potto/ActionMenu';
import { Button, PrimaryButton } from '@/components/potto/Button';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import {
  MAX_ACTIVE_CATEGORIES,
  canAddActiveCategory,
  countCategoryUsage,
  getActiveCategories,
  getArchivedCategories,
  moveCategory,
  usageLabel,
} from '@/logic/categories';
import { canManageCategories } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { PotCategory } from '@/types/models';

export default function CategoriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getCurrentMember, getCategories, getTransactions, createCategory, updateCategory, setCategoryActive, reorderCategories } =
    usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const canManage = canManageCategories(getCurrentMember(id));
  const categories = getCategories(id);
  const usage = useMemo(() => countCategoryUsage(getTransactions(id)), [getTransactions, id]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PotCategory | undefined>();
  const [archiving, setArchiving] = useState<PotCategory | undefined>();

  if (!pot) return null;

  const active = getActiveCategories(categories);
  const archived = getArchivedCategories(categories);
  const atLimit = !canAddActiveCategory(categories);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (c: PotCategory) => {
    setEditing(c);
    setFormOpen(true);
  };

  const submitForm = async (value: { name: string; icon: string; color: string }): Promise<string | undefined> => {
    const result = editing
      ? await updateCategory(id, editing.id, value)
      : await createCategory({ potId: id, ...value });
    if (!result.ok) return result.reason;
    showToast(editing ? 'Category updated' : 'Category created');
    return undefined;
  };

  const move = async (c: PotCategory, direction: -1 | 1) => {
    const result = await reorderCategories(id, moveCategory(categories, c.id, direction));
    if (!result.ok) showToast(result.reason);
  };

  const confirmArchive = async () => {
    const target = archiving;
    setArchiving(undefined);
    if (!target) return;
    const result = await setCategoryActive(id, target.id, false);
    showToast(result.ok ? `"${target.name}" archived` : result.reason);
  };

  const restore = async (c: PotCategory) => {
    const result = await setCategoryActive(id, c.id, true);
    showToast(result.ok ? `"${c.name}" restored` : result.reason);
  };

  const menuFor = (c: PotCategory, index: number): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [{ label: 'Edit', onPress: () => openEdit(c) }];
    if (index > 0) items.push({ label: 'Move up', onPress: () => void move(c, -1) });
    if (index < active.length - 1) items.push({ label: 'Move down', onPress: () => void move(c, 1) });
    items.push({ label: 'Archive', destructive: true, onPress: () => setArchiving(c) });
    return items;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Categories" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
          {canManage
            ? "Customize how this Pot's expenses are organized."
            : "How this Pot's expenses are organized. A pot admin can change these."}
        </Text>

        {canManage && (
          <View style={styles.addWrap}>
            <PrimaryButton label="+ Add category" onPress={openCreate} disabled={atLimit} />
            {atLimit && (
              <Text style={[styles.hint, { color: colors.inkSoft }]}>
                A pot can have up to {MAX_ACTIVE_CATEGORIES} active categories. Archive one to add another.
              </Text>
            )}
          </View>
        )}

        {active.length === 0 ? (
          <EmptyState
            icon="🏷️"
            title="No active categories"
            subtitle={canManage ? "Create a category to organize your Pot's expenses." : 'A pot admin can create categories.'}
            actionLabel={canManage ? '+ Add category' : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        ) : (
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {active.map((c, i) => (
              <View key={c.id} style={[styles.row, i < active.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                <CategoryIcon icon={c.icon} color={c.color} />
                <View style={styles.body}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.ink }]}>
                    {c.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.inkSoft }]}>{usageLabel(usage[c.id] ?? 0)}</Text>
                </View>
                {canManage && <ActionMenu items={menuFor(c, i)} />}
              </View>
            ))}
          </View>
        )}

        {archived.length > 0 && (
          <View style={styles.archivedWrap}>
            <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>ARCHIVED</Text>
            <Text style={[styles.hint, { color: colors.inkSoft, marginBottom: 8 }]}>
              Not offered for new expenses. Existing expenses keep them.
            </Text>
            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {archived.map((c, i) => (
                <View key={c.id} style={[styles.row, i < archived.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                  <View style={{ opacity: 0.55 }}>
                    <CategoryIcon icon={c.icon} color={c.color} />
                  </View>
                  <View style={styles.body}>
                    <Text numberOfLines={1} style={[styles.name, { color: colors.inkSoft }]}>
                      {c.name}
                    </Text>
                    <Text style={[styles.meta, { color: colors.inkSoft }]}>{usageLabel(usage[c.id] ?? 0)}</Text>
                  </View>
                  {canManage && <Button label="Restore" variant="secondary" onPress={() => void restore(c)} />}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <CategoryFormSheet visible={formOpen} category={editing} onClose={() => setFormOpen(false)} onSubmit={submitForm} />

      <ConfirmDialog
        visible={!!archiving}
        title={`Archive "${archiving?.name ?? ''}"?`}
        message="Existing expenses using this category will remain unchanged. The category will no longer appear when adding new expenses."
        confirmLabel="Archive category"
        destructive
        onConfirm={confirmArchive}
        onCancel={() => setArchiving(undefined)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  addWrap: { marginTop: 16, marginBottom: 16 },
  hint: { fontSize: 12.5, lineHeight: 17, marginTop: 8 },
  list: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12.5, marginTop: 1 },
  archivedWrap: { marginTop: 28 },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
});
