import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// expo-notifications requires a development build — since Expo SDK 53 it no
// longer works inside Expo Go (importing/using it there can throw at native
// module init). Detect Expo Go and short-circuit before touching the module
// at all, so a plain `expo start` + Expo Go session doesn't crash on launch.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Registers this device for push notifications and returns its Expo push
// token, or null if the user declined permission, this is a simulator/web
// (push tokens only work on a real device), or we're running in Expo Go.
// Safe to call every time the app starts — requesting permission when it's
// already granted is a no-op, and re-fetching the token is how Expo expects
// you to keep it current.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web' || isExpoGo) return null;

  // Dynamically imported so the module (and its native binding) is only ever
  // touched inside a real development/production build.
  const Notifications = await import('expo-notifications');

  // Foreground behavior — without this, a notification that arrives while
  // the app is open and focused is silently swallowed instead of shown as a
  // banner. Set once per app session, right before it's actually needed.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0066CC',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    // Physical-device-only, or a transient network/Expo-service failure —
    // the caller just treats "no token" as "couldn't register this time."
    return null;
  }
}
