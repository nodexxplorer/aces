import { Stack } from 'expo-router';

export default function BursarStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="dues" />
      <Stack.Screen name="payment-history" />
      <Stack.Screen name="defaulters" />
    </Stack>
  );
}
