import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import { AuthField, AuthShell, authInputStyle } from '@/components/auth/AuthShell';
import { PrimaryButton } from '@/components/potto/Button';
import { usePottoColors } from '@/constants/potto-theme';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/validation';
import { useAuth } from '@/store/AuthContext';

export default function ResetPasswordScreen() {
  const colors = usePottoColors();
  const router = useRouter();
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await updatePassword({ password, confirmPassword: confirm });
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
      title="Choose a new password"
      subtitle={
        session
          ? 'Enter a new password for your Potto account.'
          : 'Open the reset link from your email first, then choose a new password.'
      }>
      <AuthField label="New password" error={error}>
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
      <PrimaryButton
        label={loading ? 'Saving…' : 'Update password'}
        onPress={onSubmit}
        loading={loading}
        disabled={loading || !session}
        fullWidth
      />
    </AuthShell>
  );
}
