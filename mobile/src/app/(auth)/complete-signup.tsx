import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';

import { AuthField, AuthShell, authInputStyle } from '@/components/auth/AuthShell';
import { PrimaryButton } from '@/components/potto/Button';
import { usePottoColors } from '@/constants/potto-theme';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/validation';
import { useAuth } from '@/store/AuthContext';

export default function CompleteSignupScreen() {
  const colors = usePottoColors();
  const router = useRouter();
  const { establishPassword, completePendingSignupIfNeeded, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await completePendingSignupIfNeeded();
      if (!cancelled && status === 'done') router.replace('/');
    })();
    return () => {
      cancelled = true;
    };
  }, [completePendingSignupIfNeeded, router]);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await establishPassword({ password, confirmPassword: confirm });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set your password"
      subtitle={
        session
          ? 'Finish creating your Potto account. This password works on web and mobile.'
          : 'Open the verification link from your email first, then set your password here.'
      }>
      <AuthField label="Password" error={error}>
        <TextInput
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors, !!error)}
        />
      </AuthField>
      <AuthField label="Confirm password">
        <TextInput
          secureTextEntry
          textContentType="newPassword"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter password"
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors)}
        />
      </AuthField>
      {!!error && <Text style={{ color: colors.neg }}>{error}</Text>}
      <PrimaryButton
        label={loading ? 'Saving…' : 'Save password & continue'}
        onPress={onSubmit}
        loading={loading}
        disabled={loading || !session}
        fullWidth
      />
    </AuthShell>
  );
}
