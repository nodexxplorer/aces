import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function ProfileStackLayout() {
  const { theme } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
