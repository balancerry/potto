import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { Avatar } from '@/components/potto/Avatar';
import { PottoFonts, Radius, usePottoColors } from '@/constants/potto-theme';
import type { Pot } from '@/types/models';
import { formatMoney } from '@/utils/money';

export function PotCard({
  pot,
  poolBalance,
  userBalance,
  onPress,
  onDelete,
}: {
  pot: Pot;
  poolBalance: number;
  userBalance: number;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = usePottoColors();
  const shown = pot.members.slice(0, 4);
  const extra = pot.members.length - shown.length;
  const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}>
      <View style={styles.top}>
        <View style={styles.grow}>
          <Text style={[styles.name, { color: colors.ink, fontFamily: displayFont }]}>{pot.name}</Text>
          <Text style={[styles.meta, { color: colors.inkSoft }]}>
            {pot.members.length} member{pot.members.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.topRight}>
          <View style={styles.poolCol}>
            <Text style={[styles.lbl, { color: colors.inkSoft }]}>POOL</Text>
            <Text style={[styles.poolVal, { color: colors.accent, fontFamily: displayFont }]}>
              {formatMoney(poolBalance)}
            </Text>
          </View>
          <ActionMenu items={[{ label: 'Delete Pot', onPress: onDelete, destructive: true }]} />
        </View>
      </View>
      <View style={[styles.foot, { borderTopColor: colors.line }]}>
        <View style={styles.avatars}>
          {shown.map((m, i) => (
            <View key={m.id} style={[styles.avatarWrap, i > 0 && styles.avatarOverlap]}>
              <Avatar name={m.name} size={26} />
            </View>
          ))}
          {extra > 0 && (
            <View style={[styles.avatarWrap, styles.avatarOverlap]}>
              <View style={[styles.moreChip, { backgroundColor: colors.surfaceSunk }]}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>+{extra}</Text>
              </View>
            </View>
          )}
        </View>
        <Text style={[styles.balance, { color: userBalance >= 0 ? colors.pos : colors.neg }]}>
          {userBalance === 0 ? 'Settled up' : userBalance > 0 ? `You get ${formatMoney(userBalance)}` : `You owe ${formatMoney(-userBalance)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  grow: { flex: 1, paddingRight: 12 },
  name: { fontSize: 19, fontWeight: '600' },
  meta: { fontSize: 12.5, marginTop: 3 },
  topRight: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  poolCol: { alignItems: 'flex-end' },
  lbl: { fontSize: 10.5, letterSpacing: 0.5 },
  poolVal: { fontSize: 20, fontWeight: '600', marginTop: 2 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderRadius: 13 },
  avatarOverlap: { marginLeft: -8 },
  moreChip: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  balance: { fontSize: 12.5, fontWeight: '600' },
});
