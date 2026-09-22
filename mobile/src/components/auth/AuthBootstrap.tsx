import React, { useEffect, useRef, useState } from 'react';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandSplashLockup } from '@/components/animated-icon';
import { PottoPalette, usePottoColors } from '@/constants/potto-theme';
import { useAuth } from '@/store/AuthContext';
import { usePottoStore } from '@/store/PottoStore';

/**
 * Restores session → hydrates workspace → routes auth vs app.
 * Opaque splash stays up until the destination route has settled, so the
 * pots home screen cannot flash before login.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const colors = usePottoColors();
  const { session, profile, loading: authLoading, completePendingSignupIfNeeded } = useAuth();
  const { hydrateWorkspace, clearWorkspace, state } = usePottoStore();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();
  const hydratedFor = useRef<string | null>(null);
  const nativeSplashHidden = useRef(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [splashVisible, setSplashVisible] = useState(true);

  const navReady = !!navState?.key;
  const root = typeof segments[0] === 'string' ? segments[0] : '';
  const inAuthGroup = root === '(auth)' || root === 'auth';
  const authScreen = typeof segments[1] === 'string' ? segments[1] : '';
  const allowWhileAuthed =
    authScreen === 'complete-signup' ||
    authScreen === 'reset-password' ||
    authScreen === 'set-password' ||
    authScreen === 'callback' ||
    root === 'auth';

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
    if (authLoading || !navReady) return;

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (inAuthGroup && !allowWhileAuthed && state.ready) {
      router.replace('/');
    }
  }, [authLoading, navReady, session, inAuthGroup, allowWhileAuthed, state.ready, router]);

  const destinationReady =
    !authLoading &&
    navReady &&
    !bootError &&
    ((!session && inAuthGroup) || (!!session && state.ready && (!inAuthGroup || allowWhileAuthed)));

  useEffect(() => {
    if (!destinationReady) {
      setSplashVisible(true);
      return;
    }

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      // One extra frame after nav settles so the stack transition cannot peek through.
      requestAnimationFrame(() => {
        if (!cancelled) setSplashVisible(false);
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [destinationReady]);

  useEffect(() => {
    if (!splashVisible || nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync();
  }, [splashVisible]);

  if (bootError && session) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.paper, padding: 24 }]}>
        <Text style={{ color: colors.neg, textAlign: 'center', marginBottom: 12 }}>{bootError}</Text>
        <Pressable
          onPress={() => {
            hydratedFor.current = null;
            setBootError(null);
          }}>
          <Text style={{ color: colors.accent, fontWeight: '600', textAlign: 'center' }}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {children}
      {splashVisible ? (
        <View style={[styles.splashOverlay, { backgroundColor: PottoPalette.light.paper }]} pointerEvents="auto">
          <BrandSplashLockup />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
