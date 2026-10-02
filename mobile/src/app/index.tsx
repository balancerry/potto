import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { HomeScreen } from '@/components/home/HomeScreen';
import { usePottoColors } from '@/constants/potto-theme';
import { useAuth } from '@/store/AuthContext';

/**
 * Never mount the pots dashboard until we know there is a session.
 * Prevents the logged-out “home flash” during splash → login.
 */
export default function Index() {
  const { session, loading } = useAuth();
  const colors = usePottoColors();

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <HomeScreen />;
}
