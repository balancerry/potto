import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/potto/Button';
import { ConfirmDialog } from '@/components/potto/ConfirmDialog';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { disablePublicShare, enablePublicShare, fetchPublicShare } from '@/lib/api/public-pot';
import { publicSiteOrigin } from '@/lib/supabase';
import { buildPublicPotUrl, buildShareMessage, type PublicShareState } from '@/logic/public-pot';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';

/**
 * Share Pot: turn the public read-only link on/off, copy it, send it through the system share
 * sheet. Any member sees the link once it is on; only owners/admins can change it (the database
 * enforces that, this only hides what would fail).
 */
export default function SharePotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);

  const [state, setState] = useState<PublicShareState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<'enable' | 'disable' | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPublicShare(id)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  if (!pot) return null;

  const url = state?.token ? buildPublicPotUrl(publicSiteOrigin(), state.token) : null;

  const enable = async () => {
    setBusy('enable');
    try {
      setState(await enablePublicShare(pot.id));
      showToast('Public sharing is on');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not turn on sharing');
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    setBusy('disable');
    try {
      setState(await disablePublicShare(pot.id));
      setConfirmDisable(false);
      showToast('Public sharing is off');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not turn off sharing');
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    showToast('Link copied');
  };

  const share = async () => {
    if (!url) return;
    const message = buildShareMessage(pot.name);
    try {
      // iOS shows `message` and `url` separately; Android only sends `message`, so the link rides in it.
      await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` });
    } catch {
      showToast('Could not open the share sheet');
    }
  };

  const preview = () => {
    if (state?.token) router.push(`/shared/${state.token}?preview=1`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Share Pot" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.heading, { color: colors.ink }]}>Share {pot.name}</Text>
        <Text style={[styles.helper, { color: colors.inkSoft }]}>
          Anyone with the link can view this pot without joining or signing up. They can’t change anything.
        </Text>

        {failed ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>We couldn’t load the sharing settings.</Text>
            <View style={styles.actions}>
              <Button label="Try again" onPress={retry} variant="secondary" />
            </View>
          </View>
        ) : !state ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>Public sharing</Text>
              <View style={[styles.status, { backgroundColor: state.enabled ? colors.posSoft : colors.surfaceSunk }]}>
                <Text style={[styles.statusText, { color: state.enabled ? colors.pos : colors.inkSoft }]}>
                  {state.enabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>

            {state.enabled && url ? (
              <>
                <Text selectable style={[styles.link, { color: colors.ink, backgroundColor: colors.surfaceSunk, borderColor: colors.line }]}>
                  {url}
                </Text>
                <View style={styles.actions}>
                  <View style={styles.flex1}>
                    <Button label="Copy Link" onPress={copy} variant="secondary" fullWidth />
                  </View>
                  <View style={styles.flex1}>
                    <Button label="Share" onPress={share} variant="accent" fullWidth />
                  </View>
                </View>
                <View style={styles.actions}>
                  <Button label="Preview as a visitor" onPress={preview} variant="ghost" fullWidth />
                </View>
                {state.canManage ? (
                  <View style={[styles.danger, { borderTopColor: colors.line }]}>
                    <Button
                      label={busy === 'disable' ? 'Turning off…' : 'Disable Public Sharing'}
                      onPress={() => setConfirmDisable(true)}
                      variant="danger"
                      disabled={busy !== null}
                      fullWidth
                    />
                    <Text style={[styles.hint, { color: colors.inkSoft }]}>
                      The link stops working right away. Turning sharing back on creates a new link.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : state.canManage ? (
              <>
                <Text style={[styles.hint, { color: colors.inkSoft }]}>
                  Viewers see names and amounts only. No emails, phone numbers or notes.
                </Text>
                <View style={styles.actions}>
                  <Button
                    label={busy === 'enable' ? 'Turning on…' : 'Enable sharing'}
                    onPress={enable}
                    variant="primary"
                    loading={busy === 'enable'}
                    fullWidth
                  />
                </View>
              </>
            ) : (
              <Text style={[styles.hint, { color: colors.inkSoft }]}>Sharing is off. A pot admin can turn it on.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmDisable}
        title="Turn off public sharing?"
        message="The current link stops working immediately for everyone, and turning it back on creates a new link."
        confirmLabel={busy === 'disable' ? 'Turning off…' : 'Turn off'}
        destructive
        onConfirm={disable}
        onCancel={() => busy === null && setConfirmDisable(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 20, paddingBottom: 40 },
  heading: { fontSize: 18, fontWeight: '700' },
  helper: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 18 },
  loading: { paddingVertical: 32, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: Radius.xl, padding: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  status: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6 },
  link: { marginTop: 14, borderWidth: 1, borderRadius: Radius.md, padding: 12, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flex1: { flex: 1 },
  danger: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, gap: 10 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 10 },
});
