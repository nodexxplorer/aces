import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvitationsPage from '../InvitationsPage';
import { createInvitation, invitationAction, listInvitations } from '../../../api/invitations';
import type { AccessInvitation } from '../../../api/invitations';

let hod = false;
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (select: (state: unknown) => unknown) =>
    select({
      user: { id: 'requester', roles: hod ? ['hod'] : ['delegated_admin'], role: hod ? 'hod' : 'delegated_admin' },
    }),
}));
vi.mock('../../../api/invitations', () => ({
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  invitationAction: vi.fn(),
  invitationEvents: vi.fn(),
}));
const pending: AccessInvitation = {
  id: 'invite-1',
  name: 'Jane',
  email: 'jane@example.edu',
  role: 'delegated_admin',
  grants: { can_manage_courses: true },
  status: 'pending_approval',
  bootstrap: false,
  requestedBy: 'requester',
  approvedBy: null,
  acceptedBy: null,
  createdAt: '2026-11-05T12:00:00Z',
  expiresAt: '2026-11-08T12:00:00Z',
  deliveryFailed: false,
};
beforeEach(() => {
  hod = false;
  vi.clearAllMocks();
  vi.mocked(listInvitations).mockResolvedValue([]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
function fillForm() {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'jane@example.edu' } });
}
describe('Access invitations', () => {
  it('submits privileged requests for approval with selected grants', async () => {
    vi.mocked(createInvitation).mockResolvedValue(pending);
    render(<InvitationsPage />);
    fillForm();
    fireEvent.change(screen.getByLabelText('Access role'), { target: { value: 'delegated_admin' } });
    fireEvent.click(screen.getByLabelText('Courses and attendance'));
    fireEvent.click(screen.getByRole('button', { name: 'Request HOD approval' }));
    await waitFor(() =>
      expect(createInvitation).toHaveBeenCalledWith({
        email: 'jane@example.edu',
        name: 'Jane',
        role: 'delegated_admin',
        grants: { can_manage_courses: true },
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('HOD must approve');
  });
  it('does not offer delegates approval or pending-invite resend', async () => {
    vi.mocked(listInvitations).mockResolvedValue([pending]);
    render(<InvitationsPage />);
    await screen.findByText('jane@example.edu');
    expect(screen.queryByRole('button', { name: 'Approve and send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });
  it('lets HOD review grants and approve requests', async () => {
    hod = true;
    vi.mocked(listInvitations).mockResolvedValue([pending]);
    vi.mocked(invitationAction).mockResolvedValue({ ...pending, status: 'sent' });
    render(<InvitationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve and send' }));
    await waitFor(() => expect(invitationAction).toHaveBeenCalledWith('invite-1', 'approve'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Courses and attendance'));
  });
  it('lets a delegate send lecturer access directly', async () => {
    vi.mocked(createInvitation).mockResolvedValue({ ...pending, role: 'lecturer', status: 'sent' });
    render(<InvitationsPage />);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() =>
      expect(createInvitation).toHaveBeenCalledWith({
        email: 'jane@example.edu',
        name: 'Jane',
        role: 'lecturer',
        grants: {},
      }),
    );
  });
});
