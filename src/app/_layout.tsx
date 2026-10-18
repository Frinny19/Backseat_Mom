import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DataProvider } from '@/data/DataProvider';
import { onReminderTap } from '@/lib/reminders';
import { useSession } from '@/state/session';
import { fontFiles, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

const sheet = { presentation: 'formSheet' as const, sheetAllowedDetents: [0.75, 1], sheetGrabberVisible: true };
const modal = { presentation: 'modal' as const };

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontFiles);
  const status = useSession((s) => s.status);
  const init = useSession((s) => s.init);
  const { c, scheme } = useTheme();

  useEffect(() => init(), [init]);

  const ready = fontsLoaded && status !== 'loading';
  const inApp = status === 'ready' || status === 'demo';
  useEffect(() => (inApp ? onReminderTap((url) => router.push(url as never)) : undefined), [inApp]);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <DataProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Protected guard={inApp}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="log/[category]" options={sheet} />
            <Stack.Screen name="timer/[id]" options={sheet} />
            <Stack.Screen name="entry/[id]" options={sheet} />
            <Stack.Screen name="ribbon" options={sheet} />
            <Stack.Screen name="history" options={modal} />
            <Stack.Screen name="deleted" options={modal} />
            <Stack.Screen name="family" options={modal} />
            <Stack.Screen name="medications" options={modal} />
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
      </DataProvider>
    </SafeAreaProvider>
  );
}
