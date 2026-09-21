import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { usePottoColors } from '@/constants/potto-theme';
import { type AppNotification, notificationHref } from '@/lib/api/notifications';
import { useNotifications } from '@/store/NotificationsContext';
import { useToast } from '@/store/ToastContext';
import { formatDate } from '@/utils/money';

function relativeLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export default function NotificationsScreen() {
  const colors = usePottoColors();
  const { items, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }, [refresh, showToast]);

  const onOpen = async (n: AppNotification) => {
    if (!n.readAt) {
      try {
        await markRead(n.id);
      } catch {
        /* optimistic already applied */
      }
    }
    const href = notificationHref(n);
    if (href) router.push(href as Href);
  };

  const onMarkAll = async () => {
    try {
      await markAllRead();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not mark as read');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]} edges={['top']}>
      <ScreenHeader
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <Pressable onPress={onMarkAll} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Read all</Text>
            </Pressable>
          ) : (
            <View style={{ width: 56 }} />
          )
        }
      />

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }>
          {items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.inkSoft }]}>You’re all caught up</Text>
          ) : (
            items.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => void onOpen(n)}
                style={[
                  styles.row,
                  {
                    backgroundColor: n.readAt ? colors.surface : colors.accentSoft,
                    borderColor: colors.line,
                  },
                ]}>
                <View style={styles.rowTop}>
                  {!n.readAt ? (
                    <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  ) : (
                    <View style={styles.dotSpacer} />
                  )}
                  <Text style={[styles.title, { color: colors.ink }, !n.readAt && styles.titleUnread]} numberOfLines={2}>
                    {n.title}
                  </Text>
                </View>
                <Text style={[styles.body, { color: colors.inkSoft }]} numberOfLines={3}>
                  {n.body}
                </Text>
                <Text style={[styles.time, { color: colors.inkSoft }]}>{relativeLabel(n.createdAt)}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15 },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  dotSpacer: { width: 8 },
  title: { flex: 1, fontSize: 15 },
  titleUnread: { fontWeight: '600' },
  body: { marginTop: 4, marginLeft: 16, fontSize: 13, lineHeight: 18 },
  time: { marginTop: 6, marginLeft: 16, fontSize: 11 },
});
