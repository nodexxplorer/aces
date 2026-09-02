import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function BursarStackLayout() {
  const { theme } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="dues" />
      <Stack.Screen name="payment-history" />
      <Stack.Screen name="defaulters" />
    </Stack>
  );
}
