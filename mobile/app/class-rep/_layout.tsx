import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ClassRepStackLayout() {
  const { theme } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="scan-checkin" />
      <Stack.Screen name="class-list" />
      <Stack.Screen name="pending-requests" />
      <Stack.Screen name="notify" />
    </Stack>
  );
}
