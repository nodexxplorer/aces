import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserManagementPage from '../UserManagementPage';
import * as users from '../../../api/users';
import * as roleApi from '../../../api/role-management';

vi.mock('../../../api/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/users')>();
  return { ...actual, getUsers: vi.fn(), getPendingApprovals: vi.fn() };
});
vi.mock('../../../api/role-management', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/role-management')>();
  return { ...actual, getAllRoles: vi.fn() };
});
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'me', role: 'hod', activeRole: 'hod', roles: ['hod'] } }),
}));
vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({ success: vi.fn(), error: vi.fn(), notifyError: vi.fn() }),
}));

const ada = {
  id: 'u-ada',
  email: 'ada@example.edu',
  fullName: 'Ada Lovelace',
  role: 'student',
  activeRole: 'student',
  roles: ['student', 'class_rep', 'class_bursar'],
};

describe('roles tab', () => {
  it('shows the role counts, and the permissions of a person with extra roles', async () => {
    vi.mocked(users.getUsers).mockImplementation(async (params) => {
      if (params?.search) return params.search === 'ada' ? ([ada] as never) : ([] as never);
      return [ada] as never;
    });
    vi.mocked(users.getPendingApprovals).mockResolvedValue([] as never);
    vi.mocked(roleApi.getAllRoles).mockResolvedValue([
      { name: 'class_rep', description: 'Class Representative', userCount: 2 },
      { name: 'class_bursar', description: 'Class Bursar', userCount: 1 },
    ] as never);

    render(
      <MemoryRouter initialEntries={['/admin/users?tab=roles']}>
        <Routes>
          <Route path="/admin/users" element={<UserManagementPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // The system roles table shows the count from the server.
    const cells = await screen.findAllByText('class rep');
    const row = cells.map((c) => c.closest('tr')).find((r) => r) as HTMLElement;
    expect(within(row).getByText('2')).toBeInTheDocument();

    // Search for the person and open their permissions.
    fireEvent.change(screen.getByLabelText('Search for a person'), { target: { value: 'ada' } });
    const match = await screen.findByText('Ada Lovelace');
    fireEvent.click(match);

    // Her class rep and bursar roles both give permissions, on top of her student ones.
    const card = screen.getByText('Permissions for a person').closest('div.p-5') as HTMLElement;
    await waitFor(() => expect(within(card).getByText('Approve class registrations')).toBeInTheDocument());
    const statusOf = (label: string) => within(card).getByText(label).parentElement as HTMLElement;
    expect(within(statusOf('Approve class registrations')).getByText('Allowed')).toBeInTheDocument();
    expect(within(statusOf('Verify payments')).getByText('Allowed')).toBeInTheDocument();
    expect(within(statusOf('Manage users')).getByText('Not allowed')).toBeInTheDocument();
  });
});
