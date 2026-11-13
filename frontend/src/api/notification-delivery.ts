import client, { unwrap } from './client';
export interface DeliverySetup {
  email_mode: string;
  push_mode: string;
  web_push_configured: boolean;
  vapid_public_key: string;
  web_devices: number;
  mobile_devices: number;
  quiet_hours_timezone: string;
}
export interface DeliveryReport {
  channels: { channel: string; status: string; attempts: number; next_attempt_at: string; detail: string | null }[];
}
export const deliverySetup = async () => unwrap<DeliverySetup>(await client.get('/notifications/delivery-status'));
export const queueNotificationTest = async (id: string) =>
  unwrap<{ id: string; status: string }>(await client.post('/notifications/test', { id }));
export const notificationTestReport = async (id: string) =>
  unwrap<DeliveryReport>(await client.get(`/notifications/test/${id}`));
export const registerBrowserDevice = (subscription: PushSubscription) =>
  client.put('/notifications/devices', { platform: 'web', subscription: subscription.toJSON() });
export const removePushDevice = (address: string) => client.delete('/notifications/devices', { data: { address } });
