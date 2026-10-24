import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../Navbar';
import { useAuthStore } from '../../../stores/authStore';
import { useRoleStore } from '../../../stores/roleStore';
import type { User, UserRole } from '../../../types';

vi.mock('../../notifications/NotificationBell', () => ({ default: () => null }));

function setUser(roles: UserRole[], activeRole: UserRole) {
  const user = {
    id: 'u1',
    email: 's@example.com',
    firstName: 'Ada',
    lastName: 'Eze',
    roles,
    activeRole,
  } as unknown as User;
  useAuthStore.setState({ user, isAuthenticated: true });
  useRoleStore.setState({ availableRoles: roles });
}

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar onMenuClick={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('role switcher in the navbar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lets a student who also holds class rep switch to it', () => {
    setUser(['student', 'class_rep'], 'student');
    renderNavbar();
    // The switcher shows the active role; opening it lists the other role.
    fireEvent.click(screen.getAllByRole('button', { name: /^Student/ })[0]);
    expect(screen.getAllByRole('button', { name: 'Class Rep' }).length).toBeGreaterThan(0);
  });

  it('shows no switcher to a student with only the student role', () => {
    setUser(['student'], 'student');
    renderNavbar();
    expect(screen.queryByText('Switch Role')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Student/ })).not.toBeInTheDocument();
  });
});
