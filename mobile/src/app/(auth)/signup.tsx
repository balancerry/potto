import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthField, AuthShell, authInputStyle } from '@/components/auth/AuthShell';
import { PrimaryButton } from '@/components/potto/Button';
import { usePottoColors } from '@/constants/potto-theme';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/validation';
import { useAuth } from '@/store/AuthContext';

export default function SignupScreen() {
  const colors = usePottoColors();
  const router = useRouter();
  const { session, startSignup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/" />;

  const onCreate = async () => {
    setFormError(null);
    setLoading(true);
    try {
      const result = await startSignup({
        name,
        email,
        password,
        confirmPassword: confirm,
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="One Potto account works on web and mobile.">
      <AuthField label="Display name">
        <TextInput
          autoCapitalize="words"
          textContentType="name"
          value={name}
          onChangeText={setName}
          placeholder="Raj"
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors)}
        />
      </AuthField>
      <AuthField label="Email">
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors)}
        />
      </AuthField>
      <AuthField label="Password">
        <TextInput
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors)}
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

      {!!formError && <Text style={{ color: colors.neg, fontSize: 14 }}>{formError}</Text>}

      <PrimaryButton
        label={loading ? 'Creating account…' : 'Create account'}
        onPress={onCreate}
        loading={loading}
        disabled={loading}
        fullWidth
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        <Text style={{ color: colors.inkSoft }}>Already have an account?</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
