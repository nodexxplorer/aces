import { Stack } from 'expo-router';

export default function ClassRepStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="attendance" />
      <Stack.Screen name="scan-checkin" />
      <Stack.Screen name="class-list" />
      <Stack.Screen name="pending-requests" />
      <Stack.Screen name="notify" />
    </Stack>
  );
}
