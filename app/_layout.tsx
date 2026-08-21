import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { SplashView } from '../src/components/SplashView';
import { ThemeProvider } from '../src/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <SplashView />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  useEffect(() => {
    // Hand off from the native splash (solid mint-green, no image) to SplashView (same
    // background color, plus the wordmark) once the custom font is ready -- not merely once JS
    // has mounted -- so SplashView's own text never flashes in the system font first. Still
    // doesn't wait for auth bootstrap to resolve; SplashView covers that separately below.
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SafeAreaProvider>
            <RootNavigator />
            <StatusBar style="auto" />
          </SafeAreaProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
