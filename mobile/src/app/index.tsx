import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { EmptyState } from '@/components/potto/EmptyState';
import { PotCard } from '@/components/potto/PotCard';
import { PottoFonts, usePottoColors } from '@/constants/potto-theme';
import { calculateMemberBalances, calculatePoolBalance } from '@/logic/accounting';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { Pot } from '@/types/models';

export default function HomeScreen() {
  const colors = usePottoColors();
  const { state, getTransactions, getCurrentMember, deletePot } = usePottoStore();
  const { showToast } = useToast();
  const pots = Object.values(state.pots);
  const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;
  const [potPendingDelete, setPotPendingDelete] = useState<Pot | null>(null);

  const confirmDelete = () => {
    if (!potPendingDelete) return;
    deletePot(potPendingDelete.id);
    setPotPendingDelete(null);
    showToast('Pot deleted');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]} edges={['top']}>
      <View style={styles.topbar}>
        <View style={styles.wordmark}>
          <View style={[styles.mark, { backgroundColor: colors.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{'₹'}</Text>
          </View>
          <Text style={[styles.wordmarkText, { color: colors.ink, fontFamily: displayFont }]}>Potto</Text>
        </View>
      </View>
      <Text style={[styles.hello, { color: colors.inkSoft }]}>Welcome back, {state.currentUserName}</Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>MY POTS</Text>

        {pots.length === 0 ? (
          <EmptyState
            icon="🫙"
            title="No pots yet"
            subtitle="Create your first pot to start tracking a shared pool."
            onAction={() => router.push('/create-pot')}
          />
        ) : (
          <View style={styles.list}>
            {pots.map((pot) => {
              const txs = getTransactions(pot.id);
              const me = getCurrentMember(pot.id);
              const balances = calculateMemberBalances(pot.members, txs);
              return (
                <PotCard
                  key={pot.id}
                  pot={pot}
                  poolBalance={calculatePoolBalance(txs)}
                  userBalance={me ? (balances[me.id] ?? 0) : 0}
                  onPress={() => router.push(`/pot/${pot.id}`)}
                  onDelete={() => setPotPendingDelete(pot)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line, backgroundColor: colors.paper }]}>
        <View style={styles.footerRow}>
          <View style={styles.flex1}>
            <SecondaryButton label="Join a Pot" onPress={() => router.push('/join-pot')} fullWidth />
          </View>
          <View style={styles.flex1}>
            <PrimaryButton label="+ Create Pot" onPress={() => router.push('/create-pot')} fullWidth />
          </View>
        </View>
      </View>

      <ConfirmDialog
        visible={!!potPendingDelete}
        title="Delete pot?"
        message={`This will permanently delete "${potPendingDelete?.name ?? ''}" and all of its transactions, members, and settlement history. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPotPendingDelete(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  wordmarkText: { fontSize: 22, fontWeight: '600' },
  hello: { fontSize: 13.5, paddingHorizontal: 20, marginTop: 6 },
  sectionLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  scroll: { paddingBottom: 24 },
  list: { paddingHorizontal: 20, gap: 12 },
  footer: { padding: 20, borderTopWidth: 1 },
  footerRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
});
