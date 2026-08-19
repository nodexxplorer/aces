import apiClient, { unwrap } from './client';

// Mirrors frontend/src/api/notifications.ts's NotificationPreferences.
export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  email_auth: boolean;
  email_results: boolean;
  email_dues: boolean;
  email_messages: boolean;
  email_connect: boolean;
  email_skills: boolean;
  email_alumni: boolean;
  email_system: boolean;
  push_auth: boolean;
  push_results: boolean;
  push_dues: boolean;
  push_messages: boolean;
  push_connect: boolean;
  push_skills: boolean;
  push_alumni: boolean;
  push_system: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at: string;
}

export const getPreferences = async () => {
  const res = await apiClient.get('/notifications/preferences');
  return unwrap<NotificationPreferences>(res);
};

export const updatePreferences = async (prefs: Partial<NotificationPreferences>) => {
  const res = await apiClient.put('/notifications/preferences', prefs);
  return unwrap<NotificationPreferences>(res);
};

// Saves this device's Expo push token so the backend can deliver real OS
// notifications (not just the in-app/WebSocket ones) when this user isn't
// actively looking at the app.
export const registerPushToken = async (pushToken: string) => {
  const res = await apiClient.put('/notifications/push-token', { push_token: pushToken });
  return unwrap<NotificationPreferences>(res);
};
