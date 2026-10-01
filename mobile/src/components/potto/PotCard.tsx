import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionMenu } from '@/components/potto/ActionMenu';
import { Avatar } from '@/components/potto/Avatar';
import { PottoFonts, Radius, usePottoColors } from '@/constants/potto-theme';
import type { Pot } from '@/types/models';
import { formatMoney } from '@/utils/money';

export function PotCard({
  pot,
  poolBalance,
  contributed,
  spent,
  userBalance,
  pinned = false,
  onPress,
  onDelete,
  onTogglePin,
}: {
  pot: Pot;
  poolBalance: number;
  contributed: number;
  spent: number;
  userBalance: number;
  pinned?: boolean;
  onPress: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
}) {
  const colors = usePottoColors();
  const shown = pot.members.slice(0, 4);
  const extra = pot.members.length - shown.length;
  const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;
  const isShort = poolBalance < 0;
  const isEmptyPool = contributed === 0 && spent === 0;
  const progressPct = contributed > 0 ? Math.min(100, Math.round((spent / contributed) * 100)) : 0;

  const menuItems = [
    ...(onTogglePin
      ? [{ label: pinned ? 'Unpin' : 'Pin to top', onPress: onTogglePin }]
      : []),
    ...(onDelete ? [{ label: 'Delete Pot', onPress: onDelete, destructive: true as const }] : []),
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: pinned ? colors.accent : colors.line,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}>
      <View style={styles.top}>
        <View style={styles.grow}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.ink, fontFamily: displayFont }]}>{pot.name}</Text>
            {pinned ? (
              <Text style={[styles.pinBadge, { color: colors.accent, backgroundColor: colors.accentSoft }]}>
                Pinned
              </Text>
            ) : null}
          </View>
        </View>
        {menuItems.length > 0 ? <ActionMenu items={menuItems} /> : null}
      </View>

      <View style={styles.membersRow}>
        <View style={styles.avatars}>
          {shown.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.avatarWrap,
                { borderColor: colors.surface },
                i > 0 && styles.avatarOverlap,
              ]}>
              <Avatar name={m.name} size={28} />
            </View>
          ))}
          {extra > 0 && (
            <View style={[styles.avatarWrap, { borderColor: colors.surface }, styles.avatarOverlap]}>
              <View style={[styles.moreChip, { backgroundColor: colors.surfaceSunk }]}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>+{extra}</Text>
              </View>
            </View>
          )}
        </View>
        <Text style={[styles.meta, { color: colors.inkSoft }]}>
          {pot.members.length} member{pot.members.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.line }]} />

      <View>
        <Text style={[styles.lbl, { color: colors.inkSoft }]}>POOL BALANCE</Text>
        <Text style={[styles.poolVal, { color: isShort ? colors.neg : colors.accent }]}>
          {formatMoney(poolBalance)}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View>
          <Text style={[styles.lbl, { color: colors.inkSoft }]}>CONTRIBUTED</Text>
          <Text style={[styles.statVal, { color: colors.ink }]}>{formatMoney(contributed)}</Text>
        </View>
        <View>
          <Text style={[styles.lbl, { color: colors.inkSoft }]}>SPENT</Text>
          <Text style={[styles.statVal, { color: colors.ink }]}>{formatMoney(spent)}</Text>
        </View>
      </View>

      {contributed > 0 ? (
        <View style={[styles.progressTrack, { backgroundColor: colors.accentSoft }]}>
          <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: colors.gold }]} />
        </View>
      ) : null}

      {isShort ? (
        <Text style={[styles.emptyMoney, { color: colors.neg, fontStyle: 'normal', fontWeight: '600' }]}>
          Pool is short
        </Text>
      ) : isEmptyPool ? (
        <Text style={[styles.emptyMoney, { color: colors.inkSoft }]}>No money added yet</Text>
      ) : null}

      <View
        style={[
          styles.youPill,
          {
            backgroundColor: userBalance > 0 ? colors.posSoft : userBalance < 0 ? colors.negSoft : colors.surfaceSunk,
          },
        ]}>
        <Text style={[styles.youText, { color: userBalance > 0 ? colors.pos : userBalance < 0 ? colors.neg : colors.inkSoft }]}>
          {userBalance === 0
            ? 'Settled up'
            : userBalance > 0
              ? `You get ${formatMoney(userBalance)}`
              : `You owe ${formatMoney(-userBalance)}`}
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
    gap: 14,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  grow: { flex: 1, paddingRight: 12 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { fontSize: 21, fontWeight: '600' },
  pinBadge: {
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meta: { fontSize: 12.5 },
  lbl: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  poolVal: { fontSize: 26, fontWeight: '700', marginTop: 3 },
  divider: { height: 1 },
  statsRow: { flexDirection: 'row', gap: 28 },
  statVal: { fontSize: 15, fontWeight: '600', marginTop: 3 },
  avatars: { flexDirection: 'row' },
  avatarWrap: { borderRadius: 15, borderWidth: 2 },
  avatarOverlap: { marginLeft: -9 },
  moreChip: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyMoney: { fontSize: 12.5, fontStyle: 'italic' },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  youPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  youText: { fontSize: 12.5, fontWeight: '600' },
});
