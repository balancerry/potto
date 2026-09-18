import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { QRScanner } from '@/components/potto/QRScanner';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { normalizeJoinCodeInput, parseJoinCodePayload } from '@/logic/invites';
import { resolveJoinCode } from '@/logic/join-requests';
import { usePottoStore } from '@/store/PottoStore';

type Mode = 'code' | 'scan';

const ERROR_COPY: Record<'invalid' | 'disabled' | 'archived', string> = {
  invalid: "This code doesn't match an active Pot.",
  disabled: 'This Join Code has been disabled by the admin.',
  archived: 'This Pot is archived and no longer accepting new members.',
};

/**
 * NEW zero-cost join entry point (manual code entry / QR scan). The existing
 * invite-link flow (src/app/join/[code].tsx) is completely separate and
 * unaffected — this screen only ever resolves via resolveJoinCode, never
 * inviteCode, and funnels into the same JoinPotFlow/join-request system.
 */
export default function JoinPotEntryScreen() {
  const colors = usePottoColors();
  const { state } = usePottoStore();
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  const tryResolve = (rawCode: string) => {
    const resolution = resolveJoinCode(state.pots, rawCode);
    if (!resolution.ok) {
      setError(ERROR_COPY[resolution.reason]);
      return;
    }
    setError(undefined);
    router.push(`/join-pot/${resolution.pot.id}`);
  };

  const onScanned = (data: string) => {
    const parsed = parseJoinCodePayload(data);
    if (!parsed) {
      setError('Not a valid Potto QR code.');
      return;
    }
    tryResolve(parsed.code);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScreenHeader title="Join a Pot" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={styles.modeRow}>
          <Chip
            label="Enter Code"
            selected={mode === 'code'}
            onPress={() => {
              setMode('code');
              setError(undefined);
            }}
          />
          <Chip
            label="Scan QR"
            selected={mode === 'scan'}
            onPress={() => {
              setMode('scan');
              setError(undefined);
            }}
          />
        </View>

        {mode === 'code' ? (
          <>
            <Text style={[styles.label, { color: colors.inkSoft }]}>Enter the 6-character Join Code</Text>
            <TextInput
              value={code}
              onChangeText={(v) => {
                setCode(normalizeJoinCodeInput(v));
                setError(undefined);
              }}
              placeholder="7K2M9P"
              placeholderTextColor={colors.inkSoft}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={[styles.codeInput, { borderColor: colors.line, backgroundColor: colors.surfaceSunk, color: colors.ink }]}
            />
            <View style={styles.actions}>
              <PrimaryButton label="Continue" onPress={() => tryResolve(code)} fullWidth disabled={code.length !== 6} />
            </View>
          </>
        ) : (
          <View style={styles.scanWrap}>
            <QRScanner onScanned={onScanned} />
          </View>
        )}

        {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}

        <Text style={[styles.helper, { color: colors.inkSoft }]}>
          A Join Code is a short, typeable alternative to an invite link — it works the same way and always needs admin approval.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 20 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  label: { fontSize: 12.5, fontWeight: '600', marginBottom: 10 },
  codeInput: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  actions: { paddingTop: 20 },
  scanWrap: { marginBottom: 8 },
  error: { fontSize: 12.5, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  helper: { fontSize: 12, lineHeight: 17, marginTop: 24, textAlign: 'center' },
});
