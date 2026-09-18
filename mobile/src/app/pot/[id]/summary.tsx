import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { Button } from '@/components/potto/Button';
import { EmptyState } from '@/components/potto/EmptyState';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { buildPotSummaryFilename, buildPotSummaryHtml } from '@/logic/pot-summary-html';
import { buildPotSummaryViewModel } from '@/logic/pot-summary';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import { formatDateFull, formatMoney } from '@/utils/money';

/**
 * Read-only Pot Summary / Export PDF screen. Every number rendered here (and
 * in the PDF) comes from a single PotSummaryViewModel — see
 * src/logic/pot-summary.ts — built fresh from the current transactions,
 * commitments, and commitment payments, so it always matches the Dashboard,
 * Contributions, and Settle Up screens. Viewable by any active member,
 * matching the read access already granted elsewhere in the app (no new
 * permission is introduced).
 */
export default function PotSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getTransactions, getCommitments, getCommitmentPayments } = usePottoStore();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  const pot = getPot(id);
  const txs = getTransactions(id);
  const commitments = getCommitments(id);
  const commitmentPayments = commitments.flatMap((c) => getCommitmentPayments(id, c.id));

  const vm = useMemo(
    () => (pot ? buildPotSummaryViewModel(pot, txs, commitments, commitmentPayments) : null),
    [pot, txs, commitments, commitmentPayments],
  );

  if (!pot || !vm) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <EmptyState icon="❓" title="Pot not found" subtitle="This pot may have been removed." />
      </SafeAreaView>
    );
  }

  const handleExport = async () => {
    if (exporting) return;
    if (Platform.OS === 'web') {
      showToast('PDF export is available in the Potto mobile app');
      return;
    }
    setExporting(true);
    try {
      // Rebuild with a fresh timestamp right before export so the PDF reflects
      // the exact moment of generation, not when the screen first mounted.
      const freshVm = buildPotSummaryViewModel(pot, txs, commitments, commitmentPayments);
      const html = buildPotSummaryHtml(freshVm);
      const { uri } = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842,
        margins: { left: 24, right: 24, top: 24, bottom: 24 },
      });

      const filename = buildPotSummaryFilename(pot.name);
      const dest = new File(Paths.cache, filename);
      try {
        if (dest.exists) dest.delete();
      } catch {
        // best-effort cleanup of a stale export with the same filename
      }
      await new File(uri).copy(dest);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showToast('Sharing is not available on this device');
        return;
      }
      await Sharing.shareAsync(dest.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${pot.name} — Pot Summary`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error('Pot Summary PDF export failed', error);
      showToast('Could not generate the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Pot Summary" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headBlock}>
          <Text style={[styles.potName, { color: colors.ink }]}>{pot.name}</Text>
          <Text style={[styles.potMeta, { color: colors.inkSoft }]}>
            {vm.memberCount} member{vm.memberCount === 1 ? '' : 's'} · Generated {formatDateFull(vm.generatedAt)}
          </Text>
        </View>

        <Divider colors={colors} />

        <SectionLabel colors={colors} label="POOL" />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <StatRow colors={colors} label="Contributed" value={formatMoney(vm.pool.contributed)} />
          <StatRow colors={colors} label="Spent" value={formatMoney(vm.pool.totalSpent)} />
          <StatRow
            colors={colors}
            label="Pool Balance"
            value={formatMoney(vm.pool.balance)}
            valueColor={vm.pool.balance < 0 ? colors.neg : colors.pos}
          />
        </View>

        <Divider colors={colors} />

        <SectionLabel colors={colors} label="CONTRIBUTIONS" />
        <Text style={[styles.sectionTotal, { color: colors.ink }]}>{formatMoney(vm.contributions.total)} total contributed</Text>
        {vm.contributions.members.length === 0 ? (
          <Text style={[styles.emptyNote, { color: colors.inkSoft }]}>No contributions yet.</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {vm.contributions.members.map((m, i) => (
              <View key={m.memberId} style={[styles.memberRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <Text style={[styles.memberName, { color: colors.ink }]}>{m.name}</Text>
                <Text style={[styles.memberSub, { color: colors.inkSoft }]}>
                  {formatMoney(m.total)} contributed · {m.count} contribution{m.count === 1 ? '' : 's'}
                </Text>
                {m.expectation.status === 'below' && (
                  <Text style={{ color: colors.gold, fontSize: 12.5, fontWeight: '600', marginTop: 2 }}>
                    {m.count === 0 ? '⚠ No contribution yet' : `⚠ ${formatMoney(-m.expectation.difference)} below expected`}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        <Divider colors={colors} />

        <SectionLabel colors={colors} label="EXPENSES" />
        <Text style={[styles.sectionTotal, { color: colors.ink }]}>{formatMoney(vm.expenses.total)} total spent</Text>
        {vm.expenses.categories.length === 0 ? (
          <Text style={[styles.emptyNote, { color: colors.inkSoft }]}>No pool expenses yet.</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {vm.expenses.categories.map((c, i) => (
              <View key={c.category} style={[styles.simpleRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: '600' }}>{c.category}</Text>
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: '700' }}>{formatMoney(c.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        <Divider colors={colors} />

        <SectionLabel colors={colors} label="UPCOMING PAYMENTS" />
        {vm.upcoming.items.length === 0 ? (
          <Text style={[styles.emptyNote, { color: colors.inkSoft }]}>No upcoming payments.</Text>
        ) : (
          <>
            <Text style={[styles.sectionTotal, { color: colors.ink }]}>{formatMoney(vm.upcoming.totalRemaining)} remaining</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {vm.upcoming.items.map((c, i) => (
                <View key={c.id} style={[styles.simpleRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                  <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                    {c.vendorName || c.title}
                  </Text>
                  <Text style={{ color: colors.neg, fontSize: 14.5, fontWeight: '700' }}>{formatMoney(c.remaining)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Divider colors={colors} />

        <SectionLabel colors={colors} label="SETTLEMENT" />
        {vm.balances.length === 0 ? (
          <Text style={[styles.emptyNote, { color: colors.inkSoft }]}>No members.</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {vm.balances.map((b, i) => (
              <View key={b.memberId} style={[styles.simpleRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: '600' }}>{b.name}</Text>
                <Text style={{ color: b.balance === 0 ? colors.inkSoft : b.balance > 0 ? colors.pos : colors.neg, fontSize: 14.5, fontWeight: '700' }}>
                  {b.balance === 0 ? 'Settled' : b.balance > 0 ? `Gets ${formatMoney(b.balance)}` : `Owes ${formatMoney(-b.balance)}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Divider colors={colors} />

        <SectionLabel colors={colors} label="SETTLEMENT PLAN" />
        {vm.settlement.allSettled ? (
          <Text style={[styles.emptyNote, { color: colors.pos, fontWeight: '600' }]}>✓ All settled</Text>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {vm.settlement.poolFunding.map((p, i) => (
              <View key={`pf-${p.memberId}`} style={[styles.simpleRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{p.name} → Pool</Text>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{formatMoney(p.amount)}</Text>
              </View>
            ))}
            {vm.settlement.memberTransfers.map((t, i) => (
              <View
                key={`mt-${t.fromId}-${t.toId}-${i}`}
                style={[styles.simpleRow, (i > 0 || vm.settlement.poolFunding.length > 0) && { borderTopWidth: 1, borderTopColor: colors.line }]}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>
                  {t.fromName} → {t.toName}
                </Text>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700' }}>{formatMoney(t.amount)}</Text>
              </View>
            ))}
            {vm.settlement.poolFunding.length === 0 && vm.settlement.memberTransfers.length === 0 && (
              <Text style={{ color: colors.inkSoft, fontSize: 13.5, padding: 4 }}>Nothing to settle right now.</Text>
            )}
          </View>
        )}

        <View style={styles.exportWrap}>
          <Button label={exporting ? 'Preparing PDF…' : 'Export / Share PDF'} onPress={handleExport} variant="accent" fullWidth loading={exporting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof usePottoColors> }) {
  return <View style={[styles.divider, { backgroundColor: colors.line }]} />;
}

function SectionLabel({ colors, label }: { colors: ReturnType<typeof usePottoColors>; label: string }) {
  return <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>{label}</Text>;
}

function StatRow({
  colors,
  label,
  value,
  valueColor,
}: {
  colors: ReturnType<typeof usePottoColors>;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={{ color: colors.inkSoft, fontSize: 13.5 }}>{label}</Text>
      <Text style={{ color: valueColor ?? colors.ink, fontSize: 16, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  headBlock: { paddingTop: 8, paddingBottom: 4 },
  potName: { fontSize: 22, fontWeight: '700' },
  potMeta: { fontSize: 12.5, marginTop: 4 },
  divider: { height: 1, marginVertical: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 },
  sectionTotal: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  emptyNote: { fontSize: 13, marginBottom: 4 },
  card: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  memberRow: { paddingVertical: 12, paddingHorizontal: 16 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberSub: { fontSize: 12.5, marginTop: 2 },
  simpleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 10 },
  exportWrap: { marginTop: 8, marginBottom: 8 },
});
