import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';

import { AuthField, AuthShell, authInputStyle } from '@/components/auth/AuthShell';
import { PrimaryButton } from '@/components/potto/Button';
import { usePottoColors } from '@/constants/potto-theme';
import { useAuth } from '@/store/AuthContext';

export default function ForgotPasswordScreen() {
  const colors = usePottoColors();
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace({
        pathname: '/(auth)/check-email',
        params: { email: email.trim().toLowerCase(), kind: 'reset' },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot password" subtitle="We’ll email a reset link for your Potto account.">
      <AuthField label="Email" error={error}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder="you@example.com"
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors, !!error)}
        />
      </AuthField>
      <PrimaryButton
        label={loading ? 'Sending…' : 'Send reset link'}
        onPress={onSubmit}
        loading={loading}
        disabled={loading}
        fullWidth
      />
      <Link href="/(auth)/login" asChild>
        <Pressable>
          <Text style={{ color: colors.accent, fontWeight: '600', textAlign: 'center' }}>Back to sign in</Text>
        </Pressable>
      </Link>
    </AuthShell>
  );
}
