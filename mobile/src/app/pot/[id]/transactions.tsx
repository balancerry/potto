import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryFilter } from '@/components/categories/CategoryFilter';
import { Chip } from '@/components/potto/Chip';
import { ContributionsTab } from '@/components/potto/ContributionsTab';
import { EmptyState } from '@/components/potto/EmptyState';
import { PotSectionNav } from '@/components/potto/PotSectionNav';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { TransactionRow } from '@/components/potto/TransactionRow';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { sortTransactionsRecentFirst } from '@/logic/accounting';
import {
  CATEGORY_FILTER_ALL,
  categoryFilterOptions,
  matchesCategoryFilter,
  resolveCategory,
  type CategoryFilterValue,
} from '@/logic/categories';
import { usePottoStore } from '@/store/PottoStore';
type Filter = 'all' | 'contribution' | 'expense' | 'transfer' | 'settlement';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'contribution', label: 'Contributions' },
  { key: 'expense', label: 'Expenses' },
  { key: 'transfer', label: 'Transfers' },
  { key: 'settlement', label: 'Settlements' },
];

export default function TransactionsScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCategories } = usePottoStore();
  const pot = getPot(id);
  const txs = getTransactions(id);
  const initial = FILTERS.some((f) => f.key === type) ? (type as Filter) : 'all';
  const [filter, setFilter] = useState<Filter>(initial);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>(CATEGORY_FILTER_ALL);
  const categories = getCategories(id);
  const categoryOptions = useMemo(() => categoryFilterOptions(categories, txs), [categories, txs]);

  const memberName = (memberId?: string) => pot?.members.find((m) => m.id === memberId)?.name ?? '—';

  const filtered = useMemo(() => {
    const sorted = sortTransactionsRecentFirst(txs).filter((t) => matchesCategoryFilter(t, categoryFilter));
    if (filter === 'all') return sorted;
    if (filter === 'expense') return sorted.filter((t) => t.type === 'pool_expense' || t.type === 'member_expense');
    if (filter === 'transfer') return sorted.filter((t) => t.type === 'pool_transfer');
    return sorted.filter((t) => t.type === filter);
  }, [txs, filter, categoryFilter]);

  // A category only exists on expenses, so the Contributions view (which renders
  // its own per-member tab) is only used while no category is chosen.
  const categoryActive = categoryFilter !== CATEGORY_FILTER_ALL;

  if (!pot) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Activity" onBack={() => router.back()} />
      <PotSectionNav potId={id} current="activity" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        decelerationRate="fast"
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f, i) => (
          <View key={f.key} style={i > 0 && styles.chipSpacing}>
            <Chip label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.categoryRow}>
        <CategoryFilter options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {filter === 'contribution' && !categoryActive ? (
          <ContributionsTab potId={id} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="📭" title="No transactions" subtitle="Nothing to show for this filter yet." />
        ) : (
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {filtered.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                memberName={memberName}
                category={
                  t.type === 'pool_expense' || t.type === 'member_expense' ? resolveCategory(t.categoryId, categories) : undefined
                }
                onPress={() => router.push(`/pot/${id}/transaction/${t.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterScroll: { flexGrow: 0, height: 54 },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 36, paddingVertical: 10 },
  chipSpacing: { marginLeft: 8 },
  categoryRow: { paddingHorizontal: 20, paddingBottom: 10 },
  scroll: { paddingBottom: 32 },
  list: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
});
