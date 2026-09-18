import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/potto/Chip';
import { ContributionsTab } from '@/components/potto/ContributionsTab';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { TransactionRow } from '@/components/potto/TransactionRow';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { sortTransactionsRecentFirst } from '@/logic/accounting';
import { usePottoStore } from '@/store/PottoStore';
import type { TransactionType } from '@/types/models';

type Filter = 'all' | TransactionType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'contribution', label: 'Contributions' },
  { key: 'pool_expense', label: 'Pool Expenses' },
  { key: 'member_expense', label: 'Member Expenses' },
  { key: 'settlement', label: 'Settlements' },
];

export default function TransactionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions } = usePottoStore();
  const pot = getPot(id);
  const txs = getTransactions(id);
  const [filter, setFilter] = useState<Filter>('all');

  const memberName = (memberId?: string) => pot?.members.find((m) => m.id === memberId)?.name ?? '—';

  const filtered = useMemo(() => {
    const sorted = sortTransactionsRecentFirst(txs);
    if (filter === 'all') return sorted;
    return sorted.filter((t) => t.type === filter);
  }, [txs, filter]);

  if (!pot) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Activity" onBack={() => router.back()} />
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {filter === 'contribution' ? (
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
  scroll: { paddingBottom: 32 },
  list: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
});
