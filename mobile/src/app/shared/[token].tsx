import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/potto/Avatar';
import { Chip } from '@/components/potto/Chip';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { ThemeToggleButton } from '@/components/potto/ThemeToggleButton';
import { PublicTransactionRow, type PublicRowVariant } from '@/components/public/PublicTransactionRow';
import { PottoFonts, Radius, usePottoColors } from '@/constants/potto-theme';
import { fetchPublicPot } from '@/lib/api/public-pot';
import {
  contributorSummaries,
  formatPublicDate,
  groupByDate,
  publicContributions,
  publicExpenses,
  type ContributorSummary,
  type PublicMember,
  type PublicPot,
  type PublicPotResult,
  type PublicTransaction,
} from '@/logic/public-pot';
import { formatMoney } from '@/utils/money';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'contributions', label: 'Contributions' },
  { key: 'expenses', label: 'Expenses' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const MEMBERS_COLLAPSED = 8;
const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;

type Load = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'done'; result: PublicPotResult };

type Row =
  | { kind: 'label'; key: string; text: string; right?: string }
  | { kind: 'member'; key: string; member: PublicMember }
  | { kind: 'toggleMembers'; key: string; expanded: boolean; total: number }
  | { kind: 'tx'; key: string; tx: PublicTransaction; variant: PublicRowVariant }
  | { kind: 'contributor'; key: string; summary: ContributorSummary }
  | { kind: 'viewAll'; key: string }
  | { kind: 'empty'; key: string; text: string }
  | { kind: 'note'; key: string; text: string };

function truncationNote(pot: PublicPot): Row[] {
  return pot.truncated
    ? [
        {
          kind: 'note',
          key: 'truncated',
          text: `Showing the latest ${pot.transactions.length} of ${pot.transactionCount} entries. The totals above include everything.`,
        },
      ]
    : [];
}

function buildRows(pot: PublicPot, tab: TabKey, membersExpanded: boolean): Row[] {
  if (tab === 'overview') {
    const shown = membersExpanded ? pot.members : pot.members.slice(0, MEMBERS_COLLAPSED);
    const recent = pot.transactions.slice(0, 5);
    return [
      { kind: 'label', key: 'l-members', text: 'MEMBERS' },
      ...(pot.members.length === 0
        ? [{ kind: 'empty', key: 'no-members', text: 'No members yet.' } as Row]
        : shown.map((member, i): Row => ({ kind: 'member', key: `m-${i}`, member }))),
      ...(pot.members.length > MEMBERS_COLLAPSED
        ? [{ kind: 'toggleMembers', key: 'toggle', expanded: membersExpanded, total: pot.members.length } as Row]
        : []),
      { kind: 'label', key: 'l-recent', text: 'RECENT ACTIVITY' },
      ...(recent.length === 0
        ? [{ kind: 'empty', key: 'no-activity', text: 'No activity yet.' } as Row]
        : recent.map((tx, i): Row => ({ kind: 'tx', key: `r-${i}`, tx, variant: 'activity' }))),
      ...(pot.transactions.length > recent.length ? [{ kind: 'viewAll', key: 'view-all' } as Row] : []),
    ];
  }

  if (tab === 'activity') {
    if (pot.transactions.length === 0) return [{ kind: 'empty', key: 'e', text: 'No activity yet.' }];
    return [
      ...groupByDate(pot.transactions).flatMap((group, g): Row[] => [
        { kind: 'label', key: `d-${g}`, text: formatPublicDate(group.date).toUpperCase() },
        ...group.items.map((tx, i): Row => ({ kind: 'tx', key: `a-${g}-${i}`, tx, variant: 'activity' })),
      ]),
      ...truncationNote(pot),
    ];
  }

  if (tab === 'contributions') {
    const contributors = contributorSummaries(pot);
    const contributions = publicContributions(pot);
    if (contributors.length === 0 && contributions.length === 0) {
      return [{ kind: 'empty', key: 'e', text: 'No contributions yet.' }];
    }
    return [
      ...(contributors.length > 0
        ? [
            { kind: 'label', key: 'l-by', text: 'BY CONTRIBUTOR', right: `${formatMoney(pot.contributed)} total` } as Row,
            ...contributors.map((summary, i): Row => ({ kind: 'contributor', key: `c-${i}`, summary })),
          ]
        : []),
      ...(contributions.length > 0
        ? [
            { kind: 'label', key: 'l-all', text: 'ALL CONTRIBUTIONS' } as Row,
            ...contributions.map((tx, i): Row => ({ kind: 'tx', key: `t-${i}`, tx, variant: 'contribution' })),
          ]
        : []),
      ...truncationNote(pot),
    ];
  }

  const expenses = publicExpenses(pot);
  if (expenses.length === 0) return [{ kind: 'empty', key: 'e', text: 'No expenses yet.' }];
  return [
    { kind: 'label', key: 'l-exp', text: 'EXPENSES', right: `${formatMoney(pot.spent)} spent` },
    ...expenses.map((tx, i): Row => ({ kind: 'tx', key: `x-${i}`, tx, variant: 'expense' })),
    ...truncationNote(pot),
  ];
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = usePottoColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceSunk }]}>
      <Text style={[styles.statLabel, { color: colors.inkSoft }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color ?? colors.ink }]}>{value}</Text>
    </View>
  );
}

/**
 * Anonymous, read-only pot, reached from a shared link (https://…/pot/<token>, rewritten to
 * /shared/<token> by +native-intent). Works signed out and never creates an account, a
 * membership or a join request. A signed-in member of the pot is sent to the normal pot screen.
 */
export default function SharedPotScreen() {
  const { token, preview } = useLocalSearchParams<{ token: string; preview?: string }>();
  const colors = usePottoColors();
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [tab, setTab] = useState<TabKey>('overview');
  const [membersExpanded, setMembersExpanded] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPublicPot(token ?? '')
      .then((result) => {
        if (!cancelled) setLoad({ phase: 'done', result });
      })
      .catch(() => {
        if (!cancelled) {
          setLoad({ phase: 'error', message: 'We couldn’t load this pot. Check your connection and try again.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const retry = useCallback(() => {
    setLoad({ phase: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const pot = load.phase === 'done' && load.result.status === 'ok' ? load.result.pot : null;

  // Members get the full app. `?preview=1` (the Share screen's Preview button) skips this
  // so an admin can see exactly what everyone else sees.
  useEffect(() => {
    if (pot?.viewerPotId && preview !== '1') router.replace(`/pot/${pot.viewerPotId}`);
  }, [pot?.viewerPotId, preview]);

  const rows = useMemo(() => (pot ? buildRows(pot, tab, membersExpanded) : []), [pot, tab, membersExpanded]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const header = (
    <ScreenHeader
      title="Shared pot"
      onBack={goBack}
      right={<ThemeToggleButton />}
    />
  );

  if (load.phase === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (load.phase === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        {header}
        <EmptyState icon="📡" title="Something went wrong" subtitle={load.message} actionLabel="Try again" onAction={retry} />
      </SafeAreaView>
    );
  }

  if (load.result.status === 'not_found') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        {header}
        <EmptyState icon="🔗" title="Pot not found" subtitle="This public pot link may be invalid or expired." />
      </SafeAreaView>
    );
  }

  if (load.result.status === 'revoked') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        {header}
        <EmptyState
          icon="🚫"
          title="This pot is no longer publicly available."
          subtitle="Its owner turned off sharing. If you still need to see it, ask them to share a new link."
        />
      </SafeAreaView>
    );
  }

  const okPot = load.result.pot;

  // A signed-in member is being sent to the full pot screen: hold the spinner until that lands.
  if (okPot.viewerPotId && preview !== '1') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        {header}
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.badgeRow}>
          <View style={[styles.readOnly, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.readOnlyText, { color: colors.accent }]}>READ-ONLY VIEW</Text>
          </View>
          {okPot.archived ? (
            <View style={[styles.readOnly, { backgroundColor: colors.goldSoft }]}>
              <Text style={[styles.readOnlyText, { color: colors.gold }]}>ARCHIVED</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.potName, { color: colors.ink, fontFamily: displayFont }]}>{okPot.name}</Text>
        {okPot.description ? <Text style={[styles.description, { color: colors.inkSoft }]}>{okPot.description}</Text> : null}
        <View style={styles.stats}>
          <Stat label={okPot.memberCount === 1 ? 'Member' : 'Members'} value={String(okPot.memberCount)} />
          <Stat label="Contributed" value={formatMoney(okPot.contributed)} />
          <Stat label="Spent" value={formatMoney(okPot.spent)} />
          <Stat label="Remaining" value={formatMoney(okPot.balance)} color={okPot.balance < 0 ? colors.neg : colors.accent} />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerStyle={styles.tabs}
        style={styles.tabScroll}>
        {TABS.map((item) => (
          <Chip key={item.key} label={item.label} selected={tab === item.key} onPress={() => setTab(item.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      {header}
      <FlatList
        data={rows}
        keyExtractor={(row) => `${tab}-${row.key}`}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          <Text style={[styles.footer, { color: colors.inkSoft }]}>
            Shared read-only from Potto. Only names and amounts are shown; nothing here can be changed.
          </Text>
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          switch (item.kind) {
            case 'label':
              return (
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.inkSoft }]}>{item.text}</Text>
                  {item.right ? <Text style={[styles.labelRight, { color: colors.ink }]}>{item.right}</Text> : null}
                </View>
              );
            case 'member':
              return (
                <View style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Avatar name={item.member.name} size={38} />
                  <View style={styles.flex1}>
                    <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.ink }]}>
                      {item.member.name}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.inkSoft }]}>
                      {item.member.contributed > 0
                        ? `Contributed ${formatMoney(item.member.contributed)}`
                        : 'No contributions yet'}
                    </Text>
                  </View>
                </View>
              );
            case 'toggleMembers':
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: item.expanded }}
                  onPress={() => setMembersExpanded((v) => !v)}
                  style={styles.linkBtn}>
                  <Text style={[styles.link, { color: colors.accent }]}>
                    {item.expanded ? 'Show fewer members' : `Show all ${item.total} members`}
                  </Text>
                </Pressable>
              );
            case 'tx':
              return <PublicTransactionRow tx={item.tx} variant={item.variant} />;
            case 'contributor':
              return (
                <View style={[styles.contributor, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <View style={styles.contributorTop}>
                    <Text numberOfLines={1} style={[styles.rowTitle, styles.flex1, { color: colors.ink }]}>
                      {item.summary.name}
                    </Text>
                    <Text style={[styles.amount, { color: colors.ink }]}>{formatMoney(item.summary.contributed)}</Text>
                  </View>
                  <View
                    accessibilityLabel={`${Math.round(item.summary.share * 100)}% of all contributions`}
                    style={[styles.track, { backgroundColor: colors.accentSoft }]}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.max(2, Math.round(item.summary.share * 100))}%`, backgroundColor: colors.accent },
                      ]}
                    />
                  </View>
                </View>
              );
            case 'viewAll':
              return (
                <Pressable accessibilityRole="button" onPress={() => setTab('activity')} style={styles.linkBtn}>
                  <Text style={[styles.link, { color: colors.accent }]}>View all activity</Text>
                </Pressable>
              );
            case 'empty':
              return <Text style={[styles.empty, { color: colors.inkSoft }]}>{item.text}</Text>;
            case 'note':
              return <Text style={[styles.note, { color: colors.inkSoft }]}>{item.text}</Text>;
          }
        }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  hero: { borderWidth: 1, borderRadius: Radius.lg, padding: 18, marginTop: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  readOnly: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  readOnlyText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  potName: { fontSize: 28, fontWeight: '700', marginTop: 12 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  stat: { width: '48%', flexGrow: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  statLabel: { fontSize: 12, fontWeight: '500' },
  statValue: { fontSize: 20, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  tabScroll: { flexGrow: 0, marginTop: 16, marginHorizontal: -20 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
  labelRight: { fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  flex1: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  contributor: { padding: 12, borderRadius: Radius.md, borderWidth: 1, gap: 10 },
  contributorTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amount: { fontSize: 14.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 14, marginTop: 8 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 12 },
  sep: { height: 8 },
  footer: { fontSize: 12, lineHeight: 17, marginTop: 28 },
});
