import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/potto/Button';
import { CommitmentCard } from '@/components/potto/CommitmentCard';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { calculateCommitmentPaid, deriveCommitmentStatus } from '@/logic/commitments';
import { canCreateCommitment } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { formatMoney } from '@/utils/money';

export default function CommitmentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getCommitments, getCommitmentPayments, getTransactions, getCurrentMember } = usePottoStore();

  const pot = getPot(id);
  const me = getCurrentMember(id);
  const commitments = getCommitments(id);
  const transactions = getTransactions(id);
  const allPayments = commitments.flatMap((c) => getCommitmentPayments(id, c.id));

  if (!pot) return null;

  const withStatus = commitments.map((c) => {
    const paid = calculateCommitmentPaid(c.id, allPayments, transactions);
    return { commitment: c, status: deriveCommitmentStatus(c, paid) };
  });
  const active = withStatus
    .filter((c) => c.status === 'planned' || c.status === 'partially_paid')
    .sort((a, b) => (a.commitment.dueDate ?? '9999').localeCompare(b.commitment.dueDate ?? '9999'));
  const history = withStatus.filter((c) => c.status === 'fully_paid' || c.status === 'cancelled');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Upcoming Payments" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {commitments.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No Upcoming Payments yet"
            subtitle="Track a planned obligation like a hotel or venue booking before any money moves."
          />
        ) : (
          <>
            {active.length === 0 && (
              <EmptyState icon="✅" title="Nothing pending" subtitle="Every Upcoming Payment here is fully paid or cancelled." />
            )}
            {active.map(({ commitment }) => (
              <CommitmentCard
                key={commitment.id}
                commitment={commitment}
                payments={allPayments}
                transactions={transactions}
                onPress={() => router.push(`/pot/${id}/commitment/${commitment.id}`)}
              />
            ))}

            {history.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>HISTORY</Text>
                {history.map(({ commitment }) => (
                  <CommitmentCard
                    key={commitment.id}
                    commitment={commitment}
                    payments={allPayments}
                    transactions={transactions}
                    onPress={() => router.push(`/pot/${id}/commitment/${commitment.id}`)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {active.length > 0 && (
          <View style={[styles.totalRow, { borderColor: colors.line }]}>
            <Text style={{ color: colors.inkSoft, fontSize: 13 }}>Total remaining</Text>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700' }}>
              {formatMoney(active.reduce((s, { commitment }) => s + (commitment.totalAmount - calculateCommitmentPaid(commitment.id, allPayments, transactions)), 0))}
            </Text>
          </View>
        )}

        {canCreateCommitment(me) && (
          <View style={styles.actions}>
            <Button label="+ Add Upcoming Payment" onPress={() => router.push(`/pot/${id}/add-commitment`)} variant="accent" fullWidth />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingVertical: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  actions: { paddingHorizontal: 20, paddingTop: 20 },
});
