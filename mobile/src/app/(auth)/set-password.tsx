import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { AuthField, AuthShell, authInputStyle } from '@/components/auth/AuthShell';
import { PrimaryButton, SecondaryButton } from '@/components/potto/Button';
import { usePottoColors } from '@/constants/potto-theme';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/validation';
import { useAuth } from '@/store/AuthContext';

/** Optional password establishment after magic-link sign-in (same as web). */
export default function SetPasswordScreen() {
  const colors = usePottoColors();
  const router = useRouter();
  const { session, establishPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      title="Set a password"
      subtitle="Optional — add a password so you can sign in with email on web and mobile.">
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
      <View style={{ gap: 10 }}>
        <PrimaryButton
          label={loading ? 'Saving…' : 'Save password'}
          onPress={onSubmit}
          loading={loading}
          disabled={loading || !session}
          fullWidth
        />
        <SecondaryButton label="Skip for now" onPress={() => router.replace('/')} fullWidth />
      </View>
    </AuthShell>
  );
}
