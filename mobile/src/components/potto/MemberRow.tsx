import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/potto/Avatar';
import { usePottoColors } from '@/constants/potto-theme';
import type { Member } from '@/types/models';
import { formatMoney } from '@/utils/money';

export function MemberRow({
  member,
  balance,
  contributed,
  onPress,
}: {
  member: Member;
  balance: number;
  contributed: number;
  onPress?: () => void;
}) {
  const colors = usePottoColors();
  const isAdmin = member.role === 'admin';
  const isViewOnly = !isAdmin && member.accessLevel === 'view_only';
  const isInactive = member.status === 'inactive';

  return (
    <Pressable onPress={onPress} style={[styles.row, { borderBottomColor: colors.line, opacity: isInactive ? 0.55 : 1 }]}>
      <Avatar name={member.name} admin={isAdmin} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.ink }]}>{member.name}</Text>
          {isAdmin && (
            <View style={[styles.badge, { backgroundColor: colors.goldSoft }]}>
              <Text style={{ color: colors.gold, fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
            </View>
          )}
          {isViewOnly && (
            <View style={[styles.badge, { backgroundColor: colors.surfaceSunk }]}>
              <Text style={{ color: colors.inkSoft, fontSize: 10, fontWeight: '700' }}>VIEW ONLY</Text>
            </View>
          )}
          {isInactive && (
            <View style={[styles.badge, { backgroundColor: colors.surfaceSunk }]}>
              <Text style={{ color: colors.inkSoft, fontSize: 10, fontWeight: '700' }}>REMOVED</Text>
            </View>
          )}
        </View>
        <Text style={[styles.sub, { color: colors.inkSoft }]}>Contributed {formatMoney(contributed)}</Text>
      </View>
      <Text style={[styles.balance, { color: balance === 0 ? colors.inkSoft : balance > 0 ? colors.pos : colors.neg }]}>
        {balance === 0 ? formatMoney(0) : formatMoney(balance, { showSign: true })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sub: { fontSize: 12.5, marginTop: 1 },
  balance: { fontSize: 15.5, fontWeight: '600', flexShrink: 0 },
});
