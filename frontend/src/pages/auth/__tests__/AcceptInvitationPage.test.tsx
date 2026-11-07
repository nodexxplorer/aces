import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AcceptInvitationPage from '../AcceptInvitationPage';
import { acceptInvitation, inspectInvitation, type InvitationPreview } from '../../../api/invitations';
import type { User } from '../../../types';

const login = vi.fn();
const logout = vi.fn();
const navigate = vi.fn();
let currentUser: Partial<User> | null = null;
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: currentUser, login, logout }) }));
vi.mock('react-router-dom', async (original) => ({
  ...(await original<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../../api/invitations', () => ({ acceptInvitation: vi.fn(), inspectInvitation: vi.fn() }));
vi.mock('../../../api/client', () => ({ setCsrfToken: vi.fn() }));
const token = 'a'.repeat(64);
const preview: InvitationPreview = {
  department: 'Computer Engineering',
  urlCode: 'co',
  accountExists: false,
  invitation: {
    id: 'i',
    email: 'jane@example.edu',
    name: 'Jane',
    role: 'hod',
    status: 'sent',
    grants: {},
    bootstrap: true,
    requestedBy: null,
    approvedBy: null,
    acceptedBy: null,
    createdAt: '2026-11-05T12:00:00Z',
    expiresAt: '2026-11-08T12:00:00Z',
    deliveryFailed: false,
  },
};
const show = () =>
  render(
    <MemoryRouter>
      <AcceptInvitationPage />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  currentUser = null;
  window.history.replaceState({}, '', `/accept-invitation#tenant=dept-co&token=${token}`);
  vi.mocked(inspectInvitation).mockResolvedValue(preview);
});
describe('Invitation acceptance', () => {
  it('previews without granting access and removes the bearer secret from the URL', async () => {
    show();
    await screen.findByText('Computer Engineering');
    expect(inspectInvitation).toHaveBeenCalledWith('dept-co', token);
    expect(window.location.hash).toBe('');
    expect(acceptInvitation).not.toHaveBeenCalled();
  });
  it('creates a new account only after explicit acceptance and opens the correct dashboard', async () => {
    vi.mocked(acceptInvitation).mockResolvedValue({
      user: {
        id: 'new',
        email: 'jane@example.edu',
        role: 'hod',
        roles: ['hod'],
        tenant: { slug: 'dept-co', name: 'Computer Engineering', urlCode: 'co' },
      } as User,
      tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAt: 'later' },
    });
    show();
    await screen.findByText('Computer Engineering');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/Create password/), { target: { value: 'a long password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
    await waitFor(() =>
      expect(acceptInvitation).toHaveBeenCalledWith({
        tenant: 'dept-co',
        token,
        firstName: 'Jane',
        lastName: 'Doe',
        password: 'a long password',
      }),
    );
    expect(navigate).toHaveBeenCalledWith('/co/admin/dashboard', { replace: true });
    expect(sessionStorage.getItem('aces-access-invitation')).toBeNull();
  });
  it('requires existing accounts to sign in instead of setting a new password', async () => {
    vi.mocked(inspectInvitation).mockResolvedValue({ ...preview, accountExists: true });
    show();
    await screen.findByText('Computer Engineering');
    expect(screen.queryByLabelText(/Create password/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Staff sign in' })).toBeInTheDocument();
  });
  it('blocks acceptance when the wrong department account is signed in', async () => {
    currentUser = { email: 'jane@example.edu', tenant: { slug: 'other', name: 'Other' } };
    vi.mocked(inspectInvitation).mockResolvedValue({ ...preview, accountExists: true });
    show();
    await screen.findByText('Computer Engineering');
    expect(screen.getByRole('alert')).toHaveTextContent('another account or department');
    expect(screen.queryByRole('button', { name: 'Accept invitation' })).not.toBeInTheDocument();
  });
  it('shows invalid or expired link errors without activating an account', async () => {
    vi.mocked(inspectInvitation).mockRejectedValue(new Error('invalid, expired or unavailable invitation'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(acceptInvitation).not.toHaveBeenCalled();
  });
});
