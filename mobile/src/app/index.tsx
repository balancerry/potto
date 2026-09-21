import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { EmptyState } from '@/components/potto/EmptyState';
import { PotCard } from '@/components/potto/PotCard';
import { PottoFonts, usePottoColors } from '@/constants/potto-theme';
import { calculateMemberBalances, calculatePoolBalance } from '@/logic/accounting';
import { useAuth } from '@/store/AuthContext';
import { useNotifications } from '@/store/NotificationsContext';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';
import type { Pot } from '@/types/models';

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 21a2 2 0 0 0 4 0"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const colors = usePottoColors();
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { state, getTransactions, getCurrentMember, deletePot, clearWorkspace, reloadWorkspace } =
    usePottoStore();
  const { showToast } = useToast();
  const pots = Object.values(state.pots).filter((p) => p.status !== 'archived');
  const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;
  const [potPendingDelete, setPotPendingDelete] = useState<Pot | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }, [reloadWorkspace, showToast]);

  const confirmDelete = async () => {
    if (!potPendingDelete) return;
    setDeleting(true);
    try {
      await deletePot(potPendingDelete.id);
      showToast('Pot deleted');
      setPotPendingDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete pot');
    } finally {
      setDeleting(false);
    }
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      clearWorkspace();
      await signOut();
      router.replace('/(auth)/login');
    } finally {
      setSigningOut(false);
    }
  };

  const displayName = profile?.name || state.currentUserName || 'there';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]} edges={['top']}>
      <View style={styles.topbar}>
        <View style={styles.wordmark}>
          <View style={[styles.mark, { backgroundColor: colors.accent }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{'₹'}</Text>
          </View>
          <Text style={[styles.wordmarkText, { color: colors.ink, fontFamily: displayFont }]}>Potto</Text>
        </View>
        <View style={styles.topbarActions}>
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            style={[styles.bellBtn, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            <BellIcon color={colors.ink} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={onSignOut} disabled={signingOut} hitSlop={8}>
            <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>
              {signingOut ? '…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </View>
      <Text style={[styles.hello, { color: colors.inkSoft }]}>Welcome back, {displayName}</Text>
      {!!profile?.email && (
        <Text style={[styles.email, { color: colors.inkSoft }]}>{profile.email}</Text>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }>
        <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>MY POTS</Text>

        {pots.length === 0 ? (
          <EmptyState
            icon="🫙"
            title="No pots yet"
            subtitle="Create your first pot to start tracking a shared pool. Pull down to refresh."
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
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPotPendingDelete(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  wordmarkText: { fontSize: 22, fontWeight: '600' },
  hello: { fontSize: 13.5, paddingHorizontal: 20, marginTop: 6 },
  email: { fontSize: 12, paddingHorizontal: 20, marginTop: 2 },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 10,
  },
  scroll: { paddingBottom: 24, flexGrow: 1 },
  list: { paddingHorizontal: 20, gap: 12 },
  footer: { padding: 20, borderTopWidth: 1 },
  footerRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
});
