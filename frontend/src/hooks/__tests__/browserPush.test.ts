import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { enableBrowserPush, disableBrowserPush } from '../browserPush';
import * as api from '../../api/notification-delivery';
const mocks = vi.hoisted(() => ({ revision: 0 }));
vi.mock('../../stores/authStore', () => ({
  getSessionRevision: () => mocks.revision,
  useAuthStore: { getState: () => ({ isAuthenticated: true, user: { id: 'user', tenant: { slug: 'dept' } } }) },
}));
vi.mock('../../api/notification-delivery', () => ({
  deliverySetup: vi.fn(),
  registerBrowserDevice: vi.fn(),
  removePushDevice: vi.fn(),
}));
const permission = vi.fn();
const unsubscribe = vi.fn();
const subscribe = vi.fn();
const existing = vi.fn();
const subscription = { endpoint: 'https://fcm.googleapis.com/opaque', unsubscribe, toJSON: () => ({}) };
const swDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.revision = 0;
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('Notification', { requestPermission: permission, permission: 'default' });
  vi.stubGlobal('PushManager', function () {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: existing, subscribe } }) },
  });
  permission.mockResolvedValue('granted');
  existing.mockResolvedValue(null);
  subscribe.mockResolvedValue(subscription);
  unsubscribe.mockResolvedValue(true);
  vi.mocked(api.deliverySetup).mockResolvedValue({
    web_push_configured: true,
    vapid_public_key: 'BAAAAA',
    email_mode: 'live',
    push_mode: 'live',
    web_devices: 0,
    mobile_devices: 0,
    quiet_hours_timezone: 'Africa/Lagos',
  });
  vi.mocked(api.registerBrowserDevice).mockResolvedValue({} as never);
  vi.mocked(api.removePushDevice).mockResolvedValue({} as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (swDescriptor) Object.defineProperty(navigator, 'serviceWorker', swDescriptor);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});
describe('browser push', () => {
  it('does not mistake granted permission for server registration', async () => {
    await enableBrowserPush();
    expect(permission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(api.registerBrowserDevice).toHaveBeenCalledWith(subscription);
  });
  it('does not register a device after permission is denied', async () => {
    permission.mockResolvedValue('denied');
    await expect(enableBrowserPush()).rejects.toThrow('not granted');
    expect(api.registerBrowserDevice).not.toHaveBeenCalled();
  });
  it('unsubscribes locally even if backend removal fails', async () => {
    existing.mockResolvedValue(subscription);
    vi.mocked(api.removePushDevice).mockRejectedValue(new Error('offline'));
    await expect(disableBrowserPush()).rejects.toThrow('offline');
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it('does not attach an old async registration after an account change', async () => {
    subscribe.mockImplementation(async () => {
      mocks.revision++;
      return subscription;
    });
    await expect(enableBrowserPush()).rejects.toThrow('Account changed');
    expect(api.registerBrowserDevice).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
