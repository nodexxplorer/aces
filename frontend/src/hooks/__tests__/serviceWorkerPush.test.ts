import { beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const handlers = new Map<string, (event: unknown) => void>();
const values = new Map<string, Response>();
let tasks: Promise<unknown>[] = [];
const show = vi.fn();
const open = vi.fn();
const payload = (user = 'user', action = 'https://portal.example/connect') => ({
  title: 'New message',
  body: 'Open Connect',
  data: { recipient_id: user, tenant_slug: 'dept', event_id: 'event', action_url: action },
});
async function emit(type: string, event: object) {
  tasks = [];
  handlers.get(type)?.({ ...event, waitUntil: (p: Promise<unknown>) => tasks.push(p) });
  await Promise.all(tasks);
}
async function owner(value: object | null) {
  await emit('message', {
    source: { url: 'https://portal.example/app' },
    data: { type: 'NOTIFICATION_OWNER', owner: value },
  });
}
beforeEach(() => {
  handlers.clear();
  values.clear();
  tasks = [];
  show.mockClear();
  open.mockClear();
  runInNewContext(readFileSync('public/push-events.js', 'utf8'), {
    URL,
    Response,
    caches: {
      open: async () => ({
        put: async (k: string, v: Response) => {
          values.set(k, v);
        },
        match: async (k: string) => values.get(k)?.clone(),
      }),
    },
    self: {
      addEventListener: (type: string, handler: (e: unknown) => void) => handlers.set(type, handler),
      location: { origin: 'https://portal.example' },
      registration: { showNotification: show },
      clients: { matchAll: async () => [], openWindow: open },
    },
  });
});
describe('service worker push privacy', () => {
  it('shows an alert only for the bound signed-in account', async () => {
    await owner({ user: 'user', tenant: 'dept' });
    await emit('push', { data: { json: () => payload() } });
    expect(show).toHaveBeenCalledOnce();
  });
  it('suppresses another account and signed-out queued pushes', async () => {
    await owner({ user: 'other', tenant: 'dept' });
    await emit('push', { data: { json: () => payload() } });
    await owner(null);
    await emit('push', { data: { json: () => payload() } });
    expect(show).not.toHaveBeenCalled();
  });
  it('does not follow external notification action URLs', async () => {
    await owner({ user: 'user', tenant: 'dept' });
    await emit('notificationclick', {
      notification: { data: payload('user', 'https://attacker.example').data, close: vi.fn() },
    });
    expect(open).toHaveBeenCalledWith('https://portal.example/notifications');
  });
  it('does not open an old account notification after a switch', async () => {
    await owner({ user: 'other', tenant: 'dept' });
    await emit('notificationclick', { notification: { data: payload().data, close: vi.fn() } });
    expect(open).not.toHaveBeenCalled();
  });
});
