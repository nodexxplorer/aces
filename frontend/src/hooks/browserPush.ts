import { getSessionRevision, useAuthStore } from '../stores/authStore';
import { deliverySetup, registerBrowserDevice, removePushDevice } from '../api/notification-delivery';
export const browserPushSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;
async function worker() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing)
    throw new Error(
      'Browser push needs the installed production service worker. Reload after deploying the web build.',
    );
  return existing;
}
export async function enableBrowserPush() {
  const revision = getSessionRevision();
  if (!browserPushSupported())
    throw new Error(
      'Browser push needs HTTPS and a supported browser. On iPhone/iPad, use an installed Home Screen web app.',
    );
  const setup = await deliverySetup();
  if (!setup.web_push_configured || !setup.vapid_public_key)
    throw new Error('Browser push is not configured on the server.');
  if ((await Notification.requestPermission()) !== 'granted')
    throw new Error('Notification permission was not granted. Check your browser settings.');
  const registration = await worker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const raw = atob(setup.vapid_public_key.replace(/-/g, '+').replace(/_/g, '/'));
    const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  if (revision !== getSessionRevision()) {
    await subscription.unsubscribe();
    throw new Error('Account changed; please enable notifications again.');
  }
  await syncBrowserPushOwner();
  await registerBrowserDevice(subscription);
  return subscription;
}
export async function disableBrowserPush(removeServer = true) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    if (removeServer)
      try {
        await removePushDevice(subscription.endpoint);
      } finally {
        await subscription.unsubscribe();
      }
    else await subscription.unsubscribe();
  }
}
export async function syncBrowserPush() {
  const revision = getSessionRevision();
  if (!browserPushSupported() || Notification.permission !== 'granted') return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription && revision === getSessionRevision()) await registerBrowserDevice(subscription);
}

export async function syncBrowserPushOwner() {
  if (!('serviceWorker' in navigator)) return;
  const revision = getSessionRevision();
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (revision !== getSessionRevision()) return;
  const state = useAuthStore.getState();
  const owner = state.isAuthenticated && state.user ? { user: state.user.id, tenant: state.user.tenant?.slug } : null;
  registration?.active?.postMessage({ type: 'NOTIFICATION_OWNER', owner });
}
