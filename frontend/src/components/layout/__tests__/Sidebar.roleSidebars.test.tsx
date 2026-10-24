import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

let activeRole = 'class_rep';
let roles: string[] = ['class_rep'];

vi.mock('../../../hooks/useRBAC', () => ({ useRBAC: () => ({ activeRole }) }));
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { roles, firstName: 'Ada', lastName: 'Lovelace', tenant: { urlCode: 'co' }, isApproved: true },
    logout: vi.fn(),
  }),
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { tenant: { urlCode: 'co' } } }),
}));
vi.mock('../../../components/branding/department', () => ({ useCurrentDepartment: () => null }));
vi.mock('../../../components/branding/DepartmentBrand', () => ({ DepartmentLogo: () => null }));
vi.mock('../../../hooks/useDashboardPath', () => ({ useProfilePath: () => '/co/i/profile' }));

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar collapsed={false} onToggleCollapse={() => {}} mobileOpen={false} onMobileClose={() => {}} />
    </MemoryRouter>,
  );
}

describe('role sidebars', () => {
  it('class rep sees class rep items only', () => {
    activeRole = 'class_rep';
    roles = ['class_rep'];
    renderSidebar();
    expect(screen.getAllByText('Pending Registrations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Notify Classmates').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Verify Payments')).toHaveLength(0);
    expect(screen.queryAllByText('Defaulters List')).toHaveLength(0);
  });

  it('bursar sees bursar items only', () => {
    activeRole = 'class_bursar';
    roles = ['class_bursar'];
    renderSidebar();
    expect(screen.getAllByText('Verify Payments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Defaulters List').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Pending Registrations')).toHaveLength(0);
    expect(screen.queryAllByText('Notify Classmates')).toHaveLength(0);
  });
});
