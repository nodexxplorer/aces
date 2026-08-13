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

function RootNavigator() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated, user } = useAuthStore();
  const biometricEnabled = useSettingsStore((s) => s.biometricEnabled);

  const needsApproval = isAuthenticated && user?.isApproved === false;

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
        <Stack.Protected guard={isAuthenticated && !needsApproval}>
          <Stack.Screen name="(tabs)" />
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
