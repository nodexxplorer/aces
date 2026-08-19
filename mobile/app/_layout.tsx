import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useAuthStore } from '../src/store/authStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { palette } from '../src/theme/colors';
import BiometricLock from '../src/components/BiometricLock';
import { registerForPushNotificationsAsync } from '../src/utils/pushNotifications';
import { registerPushToken } from '../src/api/notifications';

function RootNavigator() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated, user } = useAuthStore();
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);

  // Registering is what actually lets the backend put something in the
  // phone's OS notification tray instead of only the in-app/WebSocket feed
  // — it's meaningless before login (no account to attach the token to) and
  // safe to repeat every time the app opens while authenticated (Expo's own
  // guidance: re-registering a still-valid token is a no-op server-side).
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) return registerPushToken(token);
      })
      .catch(() => {
        // No device, permission declined, or a transient failure — the
        // in-app/email channels still work either way, so this fails quietly.
      });
  }, [isAuthenticated]);

  // Mirrors web's global onboarding redirect (router.tsx): a freshly
  // signed-up student who hasn't completed onboarding is routed here before
  // anything else, waiting-screen included — the info onboarding collects
  // (DOB, admission mode, emergency contact) is part of what the HOD reviews
  // during approval, so it has to come first.
  const needsOnboarding = isAuthenticated && user?.onboardingCompleted === false;
  const needsApproval = isAuthenticated && !needsOnboarding && user?.isApproved === false;

  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    if (!biometricEnabled) setUnlocked(true);
  }, [biometricEnabled]);

  // Deliberately only 'background', not 'inactive': on iOS, presenting the
  // Face ID system sheet itself (from authenticateWithBiometrics below)
  // flips AppState to 'inactive' for the duration of the prompt. Treating
  // that as "user left the app" re-locks immediately after a successful
  // unlock, since the sheet's own dismissal animation can fire a delayed
  // 'inactive' event right after onUnlock() runs.
  useEffect(() => {
    if (!biometricEnabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') setUnlocked(false);
    });
    return () => sub.remove();
  }, [biometricEnabled]);

  const needsUnlock = isAuthenticated && biometricEnabled && !unlocked;

  return (
    <>
      <StatusBar style={theme.statusBar} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Protected guard={isAuthenticated && !needsOnboarding && !needsApproval}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={needsApproval}>
          <Stack.Screen name="waiting" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {needsUnlock && <BiometricLock onUnlock={() => setUnlocked(true)} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const { isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!fontsLoaded || !isHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.primary[500]} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
