import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSession } from '@/state/session';
import { fontFiles, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontFiles);
  const status = useSession((s) => s.status);
  const init = useSession((s) => s.init);
  const { c, scheme } = useTheme();

  useEffect(() => init(), [init]);

  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  const inApp = status === 'ready' || status === 'demo';
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={inApp}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log/[category]" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5, 1] }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)/sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'needsFamily'}>
          <Stack.Screen name="onboarding/family" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'needsBaby'}>
          <Stack.Screen name="onboarding/baby" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
