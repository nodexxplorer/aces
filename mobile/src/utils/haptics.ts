import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics throws on web (no hardware) — every call site would otherwise need
// its own try/catch, so centralize the platform guard here instead.
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  tap: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  select: () => isNative && Haptics.selectionAsync(),
  success: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
