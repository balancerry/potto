import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/potto/Button';
import { ContributorRow } from '@/components/potto/ContributorRow';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import {
  calculateContributionSummaries,
  calculateTotalContributions,
  evaluateContributionExpectation,
  sortContributionSummaries,
} from '@/logic/accounting';
import { usePottoStore } from '@/store/PottoStore';
import { formatMoney } from '@/utils/money';

/**
 * The member-wise Contributions view for Activity's "Contributions" filter.
 * Answers "how much has each member put in" — never balance/settlement
 * info, that's Settlement's job (see src/app/pot/[id]/settle.tsx).
 */
export function ContributionsTab({ potId }: { potId: string }) {
  const colors = usePottoColors();
  const { getPot, getTransactions } = usePottoStore();
  const pot = getPot(potId);
  const txs = getTransactions(potId);

  if (!pot) return null;

  const totalContributed = calculateTotalContributions(txs);
  const summaries = calculateContributionSummaries(pot.members, txs);
  // A removed member with zero contributions adds nothing useful to the list;
  // one who actually contributed keeps their row regardless of current status.
  const visible = summaries.filter((s) => {
    const member = pot.members.find((m) => m.id === s.memberId);
    return s.count > 0 || member?.status === 'active';
  });
  const sorted = sortContributionSummaries(
    visible,
    pot.members.map((m) => m.id),
  );

  const expectedPerMember = pot.expectedContributionPerMember;
  const belowCount = expectedPerMember
    ? sorted.filter((s) => evaluateContributionExpectation(s.total, expectedPerMember).status === 'below').length
    : 0;

  return (
    <View>
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[styles.summaryLabel, { color: colors.inkSoft }]}>TOTAL CONTRIBUTED</Text>
        <Text style={[styles.summaryAmt, { color: colors.ink }]}>{formatMoney(totalContributed)}</Text>
        <Text style={[styles.summarySub, { color: colors.inkSoft }]}>
          {totalContributed === 0 ? 'No contributions yet' : `${sorted.length} member${sorted.length === 1 ? '' : 's'}`}
        </Text>
        {belowCount > 0 && (
          <Text style={[styles.summaryWarn, { color: colors.gold }]}>
            {belowCount} need{belowCount === 1 ? 's' : ''} to contribute more
          </Text>
        )}
        {totalContributed === 0 && (
          <View style={styles.summaryAction}>
            <Button label="+ Add Money" onPress={() => router.push(`/pot/${potId}/add-money`)} variant="accent" fullWidth />
          </View>
        )}
      </View>

      {totalContributed > 0 && (
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {sorted.map((s) => {
            const member = pot.members.find((m) => m.id === s.memberId);
            if (!member) return null;
            return (
              <ContributorRow
                key={s.memberId}
                member={member}
                total={s.total}
                count={s.count}
                expectedPerMember={expectedPerMember}
                onPress={() => router.push(`/pot/${potId}/contributions/${s.memberId}`)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: { marginHorizontal: 20, marginBottom: 16, padding: 18, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  summaryAmt: { fontSize: 30, fontWeight: '700', marginTop: 6 },
  summarySub: { fontSize: 13, marginTop: 4 },
  summaryWarn: { fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  summaryAction: { alignSelf: 'stretch', marginTop: 16 },
  list: { marginHorizontal: 20, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
});
