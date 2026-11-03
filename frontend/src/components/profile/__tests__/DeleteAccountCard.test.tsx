import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeleteAccountCard from '../DeleteAccountCard';

const mockDeleteMyAccount = vi.fn();
vi.mock('../../../api/users', () => ({
  deleteMyAccount: (...args: unknown[]) => mockDeleteMyAccount(...args),
}));

const mockLogout = vi.fn();
const mockUser = { id: 'u-1', email: 'test@example.com', role: 'student' };

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

const notify = { success: vi.fn(), error: vi.fn() };
vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => notify,
}));

describe('DeleteAccountCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Danger Zone information and opens confirmation modal', () => {
    render(
      <MemoryRouter>
        <DeleteAccountCard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Danger Zone: Delete Account')).toBeInTheDocument();
    const openBtn = screen.getByRole('button', { name: /Delete My Account/i });
    expect(openBtn).toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(screen.getByText('Are you absolutely sure?')).toBeInTheDocument();
  });

  it('disables deletion until both DELETE keyword and password are typed', () => {
    render(
      <MemoryRouter>
        <DeleteAccountCard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));

    const submitBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    expect(submitBtn).toBeDisabled();

    // Type DELETE only
    const confirmInput = screen.getByPlaceholderText('Type DELETE');
    fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
    expect(submitBtn).toBeDisabled();

    // Type password only
    fireEvent.change(confirmInput, { target: { value: '' } });
    const passwordInput = screen.getByPlaceholderText('Enter your current password');
    fireEvent.change(passwordInput, { target: { value: 'my-password' } });
    expect(submitBtn).toBeDisabled();

    // Type both
    fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('calls deleteMyAccount, logs out, and redirects upon confirmation', async () => {
    mockDeleteMyAccount.mockResolvedValue({ status: 'account deleted' });

    render(
      <MemoryRouter>
        <DeleteAccountCard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));

    const confirmInput = screen.getByPlaceholderText('Type DELETE');
    const passwordInput = screen.getByPlaceholderText('Enter your current password');

    fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
    fireEvent.change(passwordInput, { target: { value: 'correct-password' } });

    const submitBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockDeleteMyAccount).toHaveBeenCalledWith({
        password: 'correct-password',
        reason: undefined,
      });
      expect(mockLogout).toHaveBeenCalled();
      expect(notify.success).toHaveBeenCalledWith('Account Deleted', expect.any(String));
    });
  });

  it('displays error notification when deletion fails (e.g. wrong password)', async () => {
    mockDeleteMyAccount.mockRejectedValue({
      response: { data: { error: 'incorrect password' } },
    });

    render(
      <MemoryRouter>
        <DeleteAccountCard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));

    const confirmInput = screen.getByPlaceholderText('Type DELETE');
    const passwordInput = screen.getByPlaceholderText('Enter your current password');

    fireEvent.change(confirmInput, { target: { value: 'DELETE' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });

    const submitBtn = screen.getByRole('button', { name: /Permanently Delete Account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('Deletion Failed', 'incorrect password');
    });
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
