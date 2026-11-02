import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

vi.mock('../../../hooks/useRBAC', () => ({ useRBAC: () => ({ activeRole: 'student' }) }));
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { roles: ['student'], firstName: 'Test', lastName: 'User', tenant: { urlCode: 'co' }, isApproved: true },
    logout: vi.fn(),
  }),
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { tenant: { urlCode: 'co' } } }),
}));
vi.mock('../../../components/branding/department', () => ({ useCurrentDepartment: () => null }));
vi.mock('../../../components/branding/DepartmentBrand', () => ({ DepartmentLogo: () => null }));
vi.mock('../../../hooks/useDashboardPath', () => ({ useProfilePath: () => '/co/i/profile' }));

describe('Sidebar hover expansion when collapsed', () => {
  it('expands on hover when collapsed and returns to collapsed when hover ends', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <Sidebar collapsed={true} onToggleCollapse={onToggle} mobileOpen={false} onMobileClose={() => {}} />
      </MemoryRouter>,
    );

    const desktopAside = container.querySelector('aside.hidden.md\\:flex');
    expect(desktopAside).toBeInTheDocument();

    // When collapsed without hover, labels are hidden
    expect(desktopAside?.textContent).not.toContain('ACADEMICS');
    expect(desktopAside?.textContent).not.toContain('Course Registration');

    // Hover over the collapsed sidebar
    fireEvent.mouseEnter(desktopAside!);

    // Now labels and section titles should be visible
    expect(desktopAside?.textContent).toContain('ACADEMICS');
    expect(desktopAside?.textContent).toContain('Course Registration');

    // Move cursor away
    fireEvent.mouseLeave(desktopAside!);

    // Should collapse back
    expect(desktopAside?.textContent).not.toContain('ACADEMICS');
    expect(desktopAside?.textContent).not.toContain('Course Registration');
  });
});

// when colapsed is  applied to the sidebar it should remain so even after changing pages  until the collapse is removed or in it hovered on

// recent transaction in bursar is not showing details.
// use the Adminpack.png beside the adminpack for the staff login, also add see password to the password input.
// Also remove the overflow from login. make  it one pages
