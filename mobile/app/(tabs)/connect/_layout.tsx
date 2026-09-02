import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function ConnectStackLayout() {
  const { theme } = useTheme();
  return (
    // This nested Stack renders its own screen containers, which default to
    // a white background regardless of the root layout's own contentStyle —
    // without this, a sliver of that white shows through at the very bottom
    // edge on some layout passes (most visible right as the keyboard closes).
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="chat/[userId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="group/[groupId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="group/[groupId]/members" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="new-group" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="discover-groups" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="join-link" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
