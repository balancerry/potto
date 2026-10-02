import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { usePottoColors } from '@/constants/potto-theme';
import { AuthProvider } from '@/store/AuthContext';
import { NotificationsProvider } from '@/store/NotificationsContext';
import { PottoProvider } from '@/store/PottoStore';
import { ThemeProvider } from '@/store/ThemeContext';
import { ToastProvider } from '@/store/ToastContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Theme first: everything below reads colors from the resolved (preference-aware) scheme.
  return (
    <ThemeProvider>
      <AppProviders />
    </ThemeProvider>
  );
}

function AppProviders() {
  const colors = usePottoColors();

  return (
    <AuthProvider>
      <PottoProvider>
        <ToastProvider>
          <NotificationsProvider>
            <AuthBootstrap>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.paper },
                }}>
                {/* No slide between splash destinations — avoids home peeking under login. */}
                <Stack.Screen name="index" options={{ animation: 'none' }} />
                <Stack.Screen name="(auth)" options={{ animation: 'none' }} />
                <Stack.Screen name="auth/callback" options={{ animation: 'none' }} />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="appearance" options={{ presentation: 'modal' }} />
                <Stack.Screen name="create-pot" options={{ presentation: 'modal' }} />
                <Stack.Screen name="join-pot/index" options={{ presentation: 'modal' }} />
                <Stack.Screen name="pot/[id]/add-money" options={{ presentation: 'modal' }} />
                <Stack.Screen name="pot/[id]/add-expense" options={{ presentation: 'modal' }} />
                <Stack.Screen name="pot/[id]/edit-settlement" options={{ presentation: 'modal' }} />
                <Stack.Screen name="pot/[id]/add-commitment" options={{ presentation: 'modal' }} />
              </Stack>
            </AuthBootstrap>
          </NotificationsProvider>
        </ToastProvider>
      </PottoProvider>
    </AuthProvider>
  );
}
