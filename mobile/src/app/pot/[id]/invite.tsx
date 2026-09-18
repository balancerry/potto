import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/potto/Button';
import { QRCode } from '@/components/potto/QRCode';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { buildInviteLink, buildJoinCodePayload } from '@/logic/invites';
import { canEditPot, canInvite } from '@/logic/permissions';
import { usePottoStore } from '@/store/PottoStore';
import { useToast } from '@/store/ToastContext';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePottoColors();
  const { getPot, getCurrentMember, setInviteEnabled, regenerateInviteCode, setJoinEnabled, regenerateJoinCode } = usePottoStore();
  const { showToast } = useToast();
  const pot = getPot(id);
  const me = getCurrentMember(id);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  // NEW — state for the separate Join Code section below; the invite-link
  // state above is untouched.
  const [codeCopied, setCodeCopied] = useState(false);
  const [showJoinQr, setShowJoinQr] = useState(false);

  if (!pot) return null;

  if (!canInvite(me)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
        <ScreenHeader title="Invite People" onBack={() => router.back()} />
        <Text style={[styles.denied, { color: colors.inkSoft }]}>You don{"'"}t have permission to invite people to this Pot.</Text>
      </SafeAreaView>
    );
  }

  const link = buildInviteLink(pot.inviteCode);
  const isAdmin = canEditPot(me);

  const copyLink = async () => {
    await Clipboard.setStringAsync(link);
    setCopied(true);
    showToast('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    Share.share({ message: `Join "${pot.name}" on Potto: ${link}` });
  };

  const toggleInviteEnabled = (value: boolean) => {
    setInviteEnabled(pot.id, value);
    showToast(value ? 'Invite link enabled' : 'Invite link disabled');
  };

  const regenerate = () => {
    const code = regenerateInviteCode(pot.id);
    if (code) showToast('New invite link generated');
  };

  // NEW — Join Code helpers. Deliberately separate from the invite-link
  // helpers above; they never touch pot.inviteCode/inviteEnabled.
  const copyCode = async () => {
    await Clipboard.setStringAsync(pot.joinCode);
    setCodeCopied(true);
    showToast('Join Code copied');
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const shareCode = () => {
    Share.share({
      message: `Join my ${pot.name} Pot on Potto.\n\nJoin Code: ${pot.joinCode}\n\nOpen Potto → Join a Pot → Enter the code.`,
    });
  };

  const toggleJoinEnabled = (value: boolean) => {
    setJoinEnabled(pot.id, value);
    showToast(value ? 'Join Code enabled' : 'Join Code disabled');
  };

  const regenerateCode = () => {
    const code = regenerateJoinCode(pot.id);
    if (code) showToast('New Join Code generated');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Invite People" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={[styles.heading, { color: colors.ink }]}>Invite people to {pot.name}</Text>
        <Text style={[styles.helper, { color: colors.inkSoft }]}>Share this link with everyone joining this Pot.</Text>

        <View style={[styles.card, { backgroundColor: colors.ink }]}>
          <Text style={[styles.cardTrip, { color: colors.paper }]}>{pot.name}</Text>
          <Text style={[styles.code, { color: colors.paper }]}>{pot.inviteCode}</Text>
          {showQr && (
            <View style={styles.qrBox}>
              <QRCode value={link} size={140} />
            </View>
          )}
        </View>

        {!pot.inviteEnabled && (
          <View style={[styles.disabledBanner, { backgroundColor: colors.negSoft }]}>
            <Text style={{ color: colors.neg, fontSize: 12.5, fontWeight: '600' }}>
              This invite link is currently disabled. No one can request to join with it.
            </Text>
          </View>
        )}

        <View style={[styles.linkRow, { backgroundColor: colors.surfaceSunk }]}>
          <Text numberOfLines={1} style={{ flex: 1, color: colors.inkSoft, fontSize: 13 }}>
            {link}
          </Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.flex1}>
            <Button label={copied ? 'Copied!' : 'Copy Link'} onPress={copyLink} variant="secondary" fullWidth />
          </View>
          <View style={styles.flex1}>
            <Button label="Share Link" onPress={shareLink} variant="accent" fullWidth />
          </View>
        </View>
        <View style={styles.actions}>
          <Button label={showQr ? 'Hide QR Code' : 'Show QR Code'} onPress={() => setShowQr((v) => !v)} variant="secondary" fullWidth />
        </View>

        <Text style={[styles.helperSmall, { color: colors.inkSoft }]}>
          The same link works for everyone. Opening it does not grant access on its own — every request is reviewed by an admin.
        </Text>

        {isAdmin && (
          <View style={[styles.adminSection, { borderTopColor: colors.line }]}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.ink }]}>Invite link enabled</Text>
              <Switch value={pot.inviteEnabled} onValueChange={toggleInviteEnabled} />
            </View>
            <Button label="Regenerate Link" onPress={regenerate} variant="ghost" fullWidth />
          </View>
        )}

        {/* NEW — zero-cost Join Code section. A separate, shorter way to reach
            the same Pot; does not replace the invite link above. */}
        <View style={[styles.divider, { borderTopColor: colors.line }]} />
        <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>JOIN CODE</Text>
        <Text style={[styles.helper, { color: colors.inkSoft }]}>
          A short code people can type in, or scan as a QR — no link required.
        </Text>

        <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[styles.joinCodeText, { color: colors.ink }]}>{pot.joinCode}</Text>
          {showJoinQr && (
            <View style={styles.qrBox}>
              <QRCode value={buildJoinCodePayload(pot.joinCode)} size={140} />
            </View>
          )}
        </View>

        {!pot.joinEnabled && (
          <View style={[styles.disabledBanner, { backgroundColor: colors.negSoft }]}>
            <Text style={{ color: colors.neg, fontSize: 12.5, fontWeight: '600' }}>
              This Join Code is currently disabled. No one can request to join with it.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <View style={styles.flex1}>
            <Button label={codeCopied ? 'Copied!' : 'Copy Code'} onPress={copyCode} variant="secondary" fullWidth />
          </View>
          <View style={styles.flex1}>
            <Button label="Share Code" onPress={shareCode} variant="accent" fullWidth />
          </View>
        </View>
        <View style={styles.actions}>
          <Button
            label={showJoinQr ? 'Hide QR Code' : 'Show QR Code'}
            onPress={() => setShowJoinQr((v) => !v)}
            variant="secondary"
            fullWidth
          />
        </View>

        <Text style={[styles.helperSmall, { color: colors.inkSoft }]}>
          Both the invite link and the Join Code lead to the same Pot. Either way, an admin still reviews every request.
        </Text>

        {isAdmin && (
          <View style={[styles.adminSection, { borderTopColor: colors.line }]}>
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.ink }]}>Join Code enabled</Text>
              <Switch value={pot.joinEnabled} onValueChange={toggleJoinEnabled} />
            </View>
            <Button label="Regenerate Code" onPress={regenerateCode} variant="ghost" fullWidth />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 20 },
  heading: { fontSize: 18, fontWeight: '700' },
  helper: { fontSize: 13, marginTop: 4, marginBottom: 18, lineHeight: 18 },
  helperSmall: { fontSize: 12, lineHeight: 17, marginTop: 16, textAlign: 'center' },
  card: { padding: 22, borderRadius: Radius.xl, alignItems: 'center' },
  cardTrip: { fontSize: 12.5, opacity: 0.7 },
  code: { fontSize: 28, fontWeight: '700', letterSpacing: 2, marginVertical: 8 },
  qrBox: { backgroundColor: '#fff', padding: 10, borderRadius: 14, marginTop: 8 },
  disabledBanner: { borderRadius: 12, padding: 12, marginTop: 14 },
  linkRow: { borderRadius: 12, padding: 14, marginTop: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flex1: { flex: 1 },
  adminSection: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, gap: 14 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 14.5, fontWeight: '600' },
  denied: { padding: 20, fontSize: 14, lineHeight: 20 },
  divider: { borderTopWidth: 1, marginTop: 28, marginBottom: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  codeCard: { alignItems: 'center', padding: 22, borderRadius: Radius.xl, borderWidth: 1, marginTop: 14 },
  joinCodeText: { fontSize: 32, fontWeight: '700', letterSpacing: 6 },
});
