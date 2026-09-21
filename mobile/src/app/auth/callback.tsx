import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { usePottoColors } from '@/constants/potto-theme';
import { useAuth } from '@/store/AuthContext';

/**
 * Handles potto://auth/callback?code=…&next=/auth/…
 * Session exchange also runs in AuthProvider; this screen routes post-auth.
 */
export default function AuthCallbackScreen() {
  const colors = usePottoColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string; code?: string }>();
  const { session, loading, completePendingSignupIfNeeded } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      try {
        const nextRaw = typeof params.next === 'string' ? params.next : '';
        const next = decodeURIComponent(nextRaw || '');

        if (session) {
          if (next.includes('complete-signup')) {
            const status = await completePendingSignupIfNeeded();
            if (cancelled) return;
            if (status === 'done') {
              router.replace('/');
              return;
            }
            router.replace('/(auth)/complete-signup');
            return;
          }
          if (next.includes('reset-password')) {
            router.replace('/(auth)/reset-password');
            return;
          }
          if (next.includes('set-password')) {
            router.replace('/(auth)/set-password');
            return;
          }
          router.replace('/');
          return;
        }

        // Give linking handler a moment; if still no session, show error.
        await new Promise((r) => setTimeout(r, 800));
        if (!cancelled && !session) {
          setError('Could not complete sign-in from this link. Try again from the app.');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Auth callback failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, params.next, completePendingSignupIfNeeded, router]);

  if (!loading && session && !params.next) {
    return <Redirect href="/" />;
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 24 }}>
      {error ? (
        <Text style={{ color: colors.neg, textAlign: 'center' }}>{error}</Text>
      ) : (
        <ActivityIndicator color={colors.accent} size="large" />
      )}
    </View>
  );
}
