import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotificationSettingsPage from '../NotificationSettingsPage';
import * as delivery from '../../../api/notification-delivery';
const mocks = vi.hoisted(() => ({
  prefs: {
    id: 'prefs',
    user_id: 'user',
    email_enabled: true,
    push_enabled: true,
    in_app_enabled: true,
    email_auth: true,
    email_results: true,
    email_dues: true,
    email_messages: true,
    email_connect: false,
    email_skills: false,
    email_alumni: true,
    email_system: true,
    push_auth: true,
    push_results: true,
    push_dues: true,
    push_messages: true,
    push_connect: true,
    push_skills: true,
    push_alumni: true,
    push_system: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    updated_at: '2026-11-05',
  },
  save: vi.fn(),
  fetch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('../../../stores/notificationStore', () => ({
  useNotificationStore: (select: (s: unknown) => unknown) =>
    select({ preferences: mocks.prefs, fetchPreferences: mocks.fetch, updatePreferences: mocks.save }),
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user', email: 'person@example.edu' } }) }));
vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('../../../components/ui/PushNotificationToggle', () => ({ default: () => <div>Browser device setup</div> }));
vi.mock('../../../api/notification-delivery', () => ({
  queueNotificationTest: vi.fn(),
  notificationTestReport: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue(mocks.prefs);
  vi.mocked(delivery.queueNotificationTest).mockResolvedValue({ id: 'test', status: 'queued' });
  vi.mocked(delivery.notificationTestReport).mockResolvedValue({
    channels: [{ channel: 'email', status: 'simulated', attempts: 1, next_attempt_at: '', detail: null }],
  });
});
afterEach(cleanup);
const show = () =>
  render(
    <MemoryRouter>
      <NotificationSettingsPage />
    </MemoryRouter>,
  );
describe('Notification settings', () => {
  it('queues a real backend test and reports simulation instead of claiming sent', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Send a test notification' }));
    await waitFor(() => expect(delivery.queueNotificationTest).toHaveBeenCalledWith(expect.any(String)));
    expect(await screen.findByText(/email: simulated/)).toBeInTheDocument();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('does not claim success when queuing fails', async () => {
    vi.mocked(delivery.queueNotificationTest).mockRejectedValue(new Error('offline'));
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Send a test notification' }));
    expect(await screen.findByText(/Could not queue the test/)).toBeInTheDocument();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('saves null quiet-hour values when disabled', async () => {
    show();
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[switches.length - 1]);
    expect(screen.getByRole('button', { name: 'Send a test notification' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({ quiet_hours_start: null, quiet_hours_end: null }),
      ),
    );
  });
  it('refreshes actual delivery status separately from provider acceptance', async () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: 'Send a test notification' }));
    await screen.findByText(/email: simulated/);
    vi.mocked(delivery.notificationTestReport).mockResolvedValue({
      channels: [{ channel: 'email', status: 'accepted', attempts: 1, next_attempt_at: '', detail: null }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh test status' }));
    expect(await screen.findByText(/email: accepted/)).toHaveTextContent('not confirmed delivery');
  });
});
