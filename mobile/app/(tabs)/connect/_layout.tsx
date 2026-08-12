import { Stack } from 'expo-router';

export default function ConnectStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="chat/[userId]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
