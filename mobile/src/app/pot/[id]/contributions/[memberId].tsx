import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { sortTransactionsRecentFirst } from '@/logic/accounting';
import { usePottoStore } from '@/store/PottoStore';
import { formatDateFull, formatMoney } from '@/utils/money';

/**
 * A single member's contribution history, reached from Activity > Contributions.
 * Individual contribution transactions remain the source of truth — this
 * screen only filters+sorts the pot's existing ledger by (type, paidBy);
 * it stores nothing new. Tapping a row reuses the existing transaction
 * detail screen for edit/delete, unchanged.
 */
export default function MemberContributionHistoryScreen() {
  const { id, memberId } = useLocalSearchParams<{ id: string; memberId: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions } = usePottoStore();

  const pot = getPot(id);
  const member = pot?.members.find((m) => m.id === memberId);
  const contributions = sortTransactionsRecentFirst(
    getTransactions(id).filter((t) => t.type === 'contribution' && t.paidBy === memberId),
  );
  const total = contributions.reduce((s, t) => s + t.amount, 0);

  if (!pot || !member) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Contributions" onBack={() => router.back()} />
        <EmptyState icon="❓" title="Not found" subtitle="This member may have been removed." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title={member.name} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.label, { color: colors.inkSoft }]}>TOTAL CONTRIBUTED</Text>
          <Text style={[styles.amt, { color: colors.ink }]}>{formatMoney(total)}</Text>
          <Text style={[styles.sub, { color: colors.inkSoft }]}>
            {contributions.length} contribution{contributions.length === 1 ? '' : 's'}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>CONTRIBUTION HISTORY</Text>
        {contributions.length === 0 ? (
          <EmptyState icon="🪙" title="No contributions yet" subtitle={`${member.name} hasn't contributed to this Pot yet.`} />
        ) : (
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {contributions.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/pot/${id}/transaction/${t.id}`)}
                style={[styles.row, { borderBottomColor: colors.line }]}>
                <View style={styles.flex1}>
                  <Text style={[styles.date, { color: colors.inkSoft }]}>{formatDateFull(t.date)}</Text>
                  <Text style={[styles.desc, { color: colors.ink }]} numberOfLines={1}>
                    {t.description}
                  </Text>
                  {!!t.note && (
                    <Text style={[styles.note, { color: colors.inkSoft }]} numberOfLines={1}>
                      {t.note}
                    </Text>
                  )}
                </View>
                <Text style={[styles.amount, { color: colors.pos }]}>+{formatMoney(t.amount)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 18,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  amt: { fontSize: 30, fontWeight: '700', marginTop: 6 },
  sub: { fontSize: 13, marginTop: 4 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 6 },
  list: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1 },
  flex1: { flex: 1, minWidth: 0 },
  date: { fontSize: 12.5, fontWeight: '600' },
  desc: { fontSize: 14.5, fontWeight: '600', marginTop: 2 },
  note: { fontSize: 12.5, marginTop: 2 },
  amount: { fontSize: 15.5, fontWeight: '700', flexShrink: 0 },
});
