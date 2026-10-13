import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChangePasswordCard from '../ChangePasswordCard';

const changePassword = vi.fn();
vi.mock('../../../api/additional-features', () => ({
  changePassword: (...args: unknown[]) => changePassword(...args),
}));

const notify = { success: vi.fn(), error: vi.fn() };
vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => notify,
}));

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('ChangePasswordCard', () => {
  beforeEach(() => {
    changePassword.mockReset();
    notify.success.mockReset();
    notify.error.mockReset();
  });

  it('sends the change when the form is valid and clears the fields', async () => {
    changePassword.mockResolvedValue({ message: 'ok' });
    render(<ChangePasswordCard />);
    fill('old-secret', 'new-secret', 'new-secret');
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('old-secret', 'new-secret'));
    await waitFor(() => expect(notify.success).toHaveBeenCalled());
    expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('');
  });

  it('refuses a mismatched confirmation without calling the server', () => {
    render(<ChangePasswordCard />);
    fill('old-secret', 'new-secret', 'typo-secret');
    expect(screen.getByRole('alert').textContent).toMatch(/do not match/);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses a new password shorter than the server allows', () => {
    render(<ChangePasswordCard />);
    fill('old-secret', 'abc', 'abc');
    expect(screen.getByRole('alert').textContent).toMatch(/at least 6/);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses a new password equal to the current one', () => {
    render(<ChangePasswordCard />);
    fill('same-secret', 'same-secret', 'same-secret');
    expect(screen.getByRole('alert').textContent).toMatch(/different from the current/);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('shows the server message when the current password is wrong', async () => {
    changePassword.mockRejectedValue({ response: { data: { error: 'current password is incorrect' } } });
    render(<ChangePasswordCard />);
    fill('wrong-secret', 'new-secret', 'new-secret');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('current password is incorrect'));
    expect(notify.error).toHaveBeenCalledWith('Password not changed', 'current password is incorrect');
  });
});
