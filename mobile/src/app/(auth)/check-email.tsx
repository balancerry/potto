import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { usePottoColors } from '@/constants/potto-theme';
import { useAuth } from '@/store/AuthContext';

export default function CheckEmailScreen() {
  const colors = usePottoColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; kind?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const kind = params.kind === 'reset' ? 'reset' : params.kind === 'magic' ? 'magic' : 'signup';
  const { signInWithMagicLink, requestPasswordReset } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const copy =
    kind === 'reset'
      ? 'If an account exists for that email, a password reset link is on the way.'
      : kind === 'magic'
        ? 'Open the magic link on this device to finish signing in.'
        : 'Open the verification link on this device. Your password will be set automatically after verification.';

  const resend = async () => {
    if (!email) return;
    setLoading(true);
    setMessage(null);
    try {
      if (kind === 'reset') {
        const r = await requestPasswordReset(email);
        setMessage(r.ok ? 'Reset email resent.' : r.error);
      } else if (kind === 'magic') {
        const r = await signInWithMagicLink(email);
        setMessage(r.ok ? 'Magic link resent.' : r.error);
      } else {
        setMessage('Return to Create account to resend with your password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Check your email" subtitle={email ? `Sent to ${email}. ${copy}` : copy}>
      {!!message && <Text style={{ color: colors.inkSoft }}>{message}</Text>}
      <PrimaryButton label={loading ? 'Sending…' : 'Resend email'} onPress={resend} loading={loading} fullWidth />
      <SecondaryButton label="Back to sign in" onPress={() => router.replace('/(auth)/login')} fullWidth />
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Use a different email</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
