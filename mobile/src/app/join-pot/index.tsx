import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/potto/Button';
import { Chip } from '@/components/potto/Chip';
import { QRScanner } from '@/components/potto/QRScanner';
import { ScreenHeader } from '@/components/potto/ScreenHeader';
import { Radius, usePottoColors } from '@/constants/potto-theme';
import { resolveJoinCodeRemote } from '@/lib/api/resolve';
import { normalizeJoinCodeInput, parseJoinCodePayload } from '@/logic/invites';

type Mode = 'code' | 'scan';

/**
 * Join via 6-character code or QR. Resolves against Supabase (same as web),
 * not the local workspace — so pots the user is not yet a member of still work.
 */
export default function JoinPotEntryScreen() {
  const colors = usePottoColors();
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const tryResolve = async (rawCode: string) => {
    const normalized = normalizeJoinCodeInput(rawCode);
    if (normalized.length !== 6) {
      setError('Enter a 6-character Join Code');
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const pot = await resolveJoinCodeRemote(normalized);
      if (!pot) {
        setError("This code doesn't match an active Pot.");
        return;
      }
      if (pot.status === 'archived') {
        setError('This Pot is archived and no longer accepting new members.');
        return;
      }
      if (!pot.enabled) {
        setError('This Join Code has been disabled by the admin.');
        return;
      }
      router.push(`/join-pot/${pot.id}?code=${encodeURIComponent(normalized)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not look up that code');
    } finally {
      setLoading(false);
    }
  };

  const onScanned = (data: string) => {
    const parsed = parseJoinCodePayload(data);
    if (!parsed) {
      setError('Not a valid Potto QR code.');
      return;
    }
    void tryResolve(parsed.code);
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
              <PrimaryButton
                label={loading ? 'Looking up…' : 'Continue'}
                onPress={() => void tryResolve(code)}
                fullWidth
                disabled={code.length !== 6 || loading}
                loading={loading}
              />
            </View>
          </>
        ) : (
          <View style={styles.scanWrap}>
            <QRScanner onScanned={onScanned} />
          </View>
        )}

        {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}

        <Text style={[styles.helper, { color: colors.inkSoft }]}>
          Enter the 6-character Join Code or scan the QR. Every request still needs admin approval.
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
