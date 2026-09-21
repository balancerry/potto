import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AuthBootstrap } from '@/components/auth/AuthBootstrap';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PottoPalette } from '@/constants/potto-theme';
import { AuthProvider } from '@/store/AuthContext';
import { NotificationsProvider } from '@/store/NotificationsContext';
import { PottoProvider } from '@/store/PottoStore';
import { ToastProvider } from '@/store/ToastContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? PottoPalette.dark : PottoPalette.light;

  return (
    <AuthProvider>
      <PottoProvider>
        <ToastProvider>
          <NotificationsProvider>
            <AuthBootstrap>
              <AnimatedSplashOverlay />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="auth/callback" />
                <Stack.Screen name="notifications" />
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
