import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { usePottoColors } from '@/constants/potto-theme';
import { useAuth } from '@/store/AuthContext';
import { usePottoStore } from '@/store/PottoStore';

/**
 * Restores session → hydrates shared Supabase workspace → routes auth vs app.
 * Clears local pot state on sign-out so accounts never leak.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const colors = usePottoColors();
  const { session, profile, loading: authLoading, completePendingSignupIfNeeded } = useAuth();
  const { hydrateWorkspace, clearWorkspace, state } = usePottoStore();
  const segments = useSegments();
  const router = useRouter();
  const hydratedFor = useRef<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!session?.user) {
      hydratedFor.current = null;
      clearWorkspace();
      setBootError(null);
      return;
    }

    const userId = session.user.id;
    if (hydratedFor.current === userId && state.ready) return;

    let cancelled = false;
    (async () => {
      try {
        await completePendingSignupIfNeeded();
        const name =
          profile?.name ||
          (typeof session.user.user_metadata?.name === 'string'
            ? session.user.user_metadata.name
            : session.user.email?.split('@')[0]) ||
          'User';
        await hydrateWorkspace(userId, name);
        if (!cancelled) {
          hydratedFor.current = userId;
          setBootError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : 'Failed to load your pots');
          hydratedFor.current = userId;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    session?.user,
    profile?.name,
    hydrateWorkspace,
    clearWorkspace,
    completePendingSignupIfNeeded,
    state.ready,
  ]);

  useEffect(() => {
    if (authLoading) return;
    const root = segments[0];
    const inAuthGroup = root === '(auth)' || root === 'auth';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    const screen = typeof segments[1] === 'string' ? segments[1] : '';
    const allowWhileAuthed =
      screen === 'complete-signup' ||
      screen === 'reset-password' ||
      screen === 'set-password' ||
      screen === 'callback' ||
      root === 'auth';

    if (inAuthGroup && !allowWhileAuthed && state.ready) {
      router.replace('/');
    }
  }, [authLoading, session, segments, router, state.ready]);

  if (authLoading || (session && !state.ready && !bootError)) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.paper }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (bootError && session) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.paper, padding: 24 }]}>
        <Text style={{ color: colors.neg, textAlign: 'center', marginBottom: 12 }}>{bootError}</Text>
        <Text
          style={{ color: colors.accent, fontWeight: '600' }}
          onPress={() => {
            hydratedFor.current = null;
            setBootError(null);
          }}>
          Tap to retry
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
