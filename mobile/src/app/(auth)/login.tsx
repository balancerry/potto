import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthField, AuthShell, authInputStyle } from '@/components/auth/AuthShell';
import { PrimaryButton } from '@/components/potto/Button';
import { usePottoColors } from '@/constants/potto-theme';
import { useAuth } from '@/store/AuthContext';

export default function LoginScreen() {
  const colors = usePottoColors();
  const { session, signInWithPassword, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  if (session) return <Redirect href="/" />;

  const onSignIn = async () => {
    setFormError(null);
    setLoading(true);
    try {
      const result = await signInWithPassword(email, password);
      if (!result.ok) {
        setFormError(result.error);
        if (result.error.toLowerCase().includes('password')) setPasswordError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const onMagic = async () => {
    setFormError(null);
    setMagicLoading(true);
    try {
      const result = await signInWithMagicLink(email);
      if (!result.ok) {
        setFormError(result.error);
        setEmailError(result.error);
        return;
      }
      setMagicSent(true);
    } finally {
      setMagicLoading(false);
    }
  };

  if (magicSent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a magic link to ${email.trim()}. Open it on this device to finish signing in.`}>
        <PrimaryButton label="Back to sign in" onPress={() => setMagicSent(false)} fullWidth />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with the same Potto account you use on the web.">
      <AuthField label="Email" error={emailError}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setEmailError(null);
          }}
          placeholder="you@example.com"
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors, !!emailError)}
        />
      </AuthField>
      <AuthField label="Password" error={passwordError}>
        <TextInput
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setPasswordError(null);
          }}
          placeholder="Your password"
          placeholderTextColor={colors.inkSoft}
          style={authInputStyle(colors, !!passwordError)}
        />
      </AuthField>

      {!!formError && <Text style={{ color: colors.neg, fontSize: 14 }}>{formError}</Text>}

      <PrimaryButton
        label={loading ? 'Signing in…' : 'Sign in'}
        onPress={onSignIn}
        loading={loading}
        disabled={loading}
        fullWidth
      />

      <Link href="/(auth)/forgot-password" asChild>
        <Pressable>
          <Text style={{ color: colors.accent, fontWeight: '600', textAlign: 'center', marginTop: 4 }}>
            Forgot password?
          </Text>
        </Pressable>
      </Link>

      <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 8 }} />

      <PrimaryButton
        label={magicLoading ? 'Sending link…' : 'Email me a magic link'}
        onPress={onMagic}
        loading={magicLoading}
        disabled={magicLoading || loading}
        fullWidth
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        <Text style={{ color: colors.inkSoft }}>Don&apos;t have an account?</Text>
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Create account</Text>
          </Pressable>
        </Link>
      </View>
    </AuthShell>
  );
}
