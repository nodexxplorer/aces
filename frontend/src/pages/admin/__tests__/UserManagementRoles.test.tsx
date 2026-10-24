import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  return {
    ...actual,
    getAllRoles: vi.fn(),
    getAdminPermission: vi.fn(),
    grantAdminPermission: vi.fn(),
    updateAdminPermission: vi.fn(),
    revokeAdminPermission: vi.fn(),
  };
});
// The signed-in user's active role. The HOD sees the grant editor; the tests change it.
const viewer = vi.hoisted(() => ({ activeRole: 'hod' }));
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'me', role: viewer.activeRole, activeRole: viewer.activeRole, roles: [viewer.activeRole] },
  }),
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

const bea = {
  id: 'u-bea',
  email: 'bea@example.edu',
  fullName: 'Bea Admin',
  role: 'delegated_admin',
  activeRole: 'delegated_admin',
  roles: ['delegated_admin'],
};

function openPersonPanel(person: typeof bea) {
  vi.mocked(users.getUsers).mockImplementation(async (params) => {
    if (params?.search) return params.search === 'bea' ? ([person] as never) : ([] as never);
    return [person] as never;
  });
  vi.mocked(users.getPendingApprovals).mockResolvedValue([] as never);
  vi.mocked(roleApi.getAllRoles).mockResolvedValue([] as never);
  render(
    <MemoryRouter initialEntries={['/admin/users?tab=roles']}>
      <Routes>
        <Route path="/admin/users" element={<UserManagementPage />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText('Search for a person'), { target: { value: 'bea' } });
  return screen.findByText('Bea Admin').then((match) => fireEvent.click(match));
}

const ALL_OFF = {
  can_manage_results: false,
  can_manage_users: false,
  can_manage_finance: false,
  can_manage_courses: false,
  can_view_analytics: false,
  can_manage_announcements: false,
  can_backup_data: false,
  can_manage_complaints: false,
  can_manage_alumni: false,
  can_manage_course_forms: false,
  can_manage_settings: false,
};

describe('admin grants editor', () => {
  beforeEach(() => {
    viewer.activeRole = 'hod';
    vi.mocked(roleApi.getAdminPermission).mockRejectedValue({ response: { status: 404 } });
    vi.mocked(roleApi.grantAdminPermission).mockResolvedValue({ user_id: 'u-bea' } as never);
    vi.mocked(roleApi.updateAdminPermission).mockResolvedValue({ user_id: 'u-bea' } as never);
  });
  afterEach(() => {
    viewer.activeRole = 'hod';
    vi.clearAllMocks();
  });

  it('lets the HOD edit grants, and the permissions panel follows the saved grant', async () => {
    vi.mocked(roleApi.getAdminPermission).mockResolvedValue({
      user_id: 'u-bea',
      is_active: true,
      ...ALL_OFF,
      can_manage_results: true,
    } as never);
    await openPersonPanel(bea);

    const section = (await screen.findByRole('region', { name: 'Admin grants' })) as HTMLElement;
    expect(within(section).getByRole('checkbox', { name: /Results and grades/ })).toBeChecked();
    expect(within(section).getByRole('checkbox', { name: /Users and roles/ })).not.toBeChecked();

    const card = screen.getByText('Permissions for a person').closest('div.p-5') as HTMLElement;
    const statusOf = (label: string) => within(card).getByText(label).parentElement as HTMLElement;
    await waitFor(() => expect(within(statusOf('Enter and review scores')).getByText('Allowed')).toBeInTheDocument());
    expect(within(statusOf('Manage users')).getByText('Not allowed')).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('checkbox', { name: /Users and roles/ }));
    fireEvent.click(within(section).getByRole('button', { name: 'Save grants' }));
    await waitFor(() =>
      expect(roleApi.updateAdminPermission).toHaveBeenCalledWith('u-bea', {
        ...ALL_OFF,
        can_manage_results: true,
        can_manage_users: true,
      }),
    );
    expect(roleApi.grantAdminPermission).not.toHaveBeenCalled();
  });

  it('creates the grant when the person has none yet', async () => {
    await openPersonPanel(bea);
    const section = (await screen.findByRole('region', { name: 'Admin grants' })) as HTMLElement;
    fireEvent.click(within(section).getByRole('checkbox', { name: /Analytics and reports/ }));
    fireEvent.click(within(section).getByRole('button', { name: 'Save grants' }));
    await waitFor(() =>
      expect(roleApi.grantAdminPermission).toHaveBeenCalledWith('u-bea', { ...ALL_OFF, can_view_analytics: true }),
    );
    expect(roleApi.updateAdminPermission).not.toHaveBeenCalled();
  });

  it('does not show the editor to a delegated admin, who sees admin areas as set by the HOD', async () => {
    viewer.activeRole = 'delegated_admin';
    await openPersonPanel(bea);
    const card = (await screen.findByText('Permissions for a person')).closest('div.p-5') as HTMLElement;
    const statusOf = (label: string) => within(card).getByText(label).parentElement as HTMLElement;
    await waitFor(() => expect(within(statusOf('Manage users')).getByText('Set by HOD')).toBeInTheDocument());
    expect(screen.queryByRole('region', { name: 'Admin grants' })).not.toBeInTheDocument();
    expect(roleApi.getAdminPermission).not.toHaveBeenCalled();
  });
});
