import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/potto/Avatar';
import { usePottoColors } from '@/constants/potto-theme';
import { evaluateContributionExpectation } from '@/logic/accounting';
import type { Member } from '@/types/models';
import { formatMoney } from '@/utils/money';

/**
 * One member's row on the Activity > Contributions tab. Deliberately shows
 * only contribution totals — never balance/settlement info (that's Settlement's
 * job, see calculateMemberBalances / MemberRow).
 *
 * `expectedPerMember` is optional (Pot.expectedContributionPerMember). When
 * unset, no expectation indicator is rendered at all — this is purely
 * informational and never affects balances or settlement.
 */
export function ContributorRow({
  member,
  total,
  count,
  expectedPerMember,
  onPress,
}: {
  member: Member;
  total: number;
  count: number;
  expectedPerMember?: number | null;
  onPress: () => void;
}) {
  const colors = usePottoColors();
  const hasContributed = count > 0;
  const expectation = evaluateContributionExpectation(total, expectedPerMember);
  const isBelow = expectation.status === 'below';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.line, backgroundColor: isBelow ? colors.goldSoft : undefined }]}>
      <Avatar name={member.name} admin={member.role === 'admin'} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.ink, flexShrink: 1 }]}>
            {member.name}
          </Text>
          <Text style={{ color: colors.inkSoft, fontSize: 16 }}>{'›'}</Text>
        </View>
        <Text style={[styles.amt, { color: hasContributed ? colors.pos : colors.inkSoft }]}>
          {formatMoney(total)} contributed
        </Text>
        <Text style={[styles.count, { color: colors.inkSoft }]}>
          {hasContributed ? `${count} contribution${count === 1 ? '' : 's'}` : 'No contributions yet'}
        </Text>
        {expectation.status !== 'none' && (
          <Text style={[styles.expectation, { color: isBelow ? colors.gold : colors.pos }]}>
            {expectation.status === 'on_track' && '✓ On track'}
            {expectation.status === 'above' && `✓ ${formatMoney(expectation.difference)} above expected`}
            {isBelow && (!hasContributed ? '⚠ No contribution yet' : `⚠ ${formatMoney(-expectation.difference)} below expected`)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  body: { flex: 1, minWidth: 0 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '600' },
  amt: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  count: { fontSize: 12.5, marginTop: 2 },
  expectation: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
