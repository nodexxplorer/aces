import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LecturerProfilePage from '../LecturerProfilePage';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.edu',
      role: 'lecturer',
      activeRole: 'lecturer',
      tenant: { urlCode: 'co', name: 'Computer Engineering' },
    },
    updateUser: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('../../../components/profile/ChangePasswordCard', () => ({
  default: () => <div>Change password card</div>,
}));
vi.mock('../../../api/lecturers', () => ({
  getLecturerProfile: vi.fn(async () => ({ profile: null, assignments: [], leaves: [] })),
  updateLecturerProfile: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LecturerProfilePage />
    </MemoryRouter>,
  );
}

describe('LecturerProfilePage', () => {
  it('shows no admin privileges or admin areas', () => {
    renderPage();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Privileges')).not.toBeInTheDocument();
    expect(screen.queryByText('Roles and permissions')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit log')).not.toBeInTheDocument();
    expect(screen.queryByText(/manage \d+ areas/)).not.toBeInTheDocument();
  });

  it('keeps password change on the Security tab', () => {
    renderPage();
    expect(screen.queryByText('Change password card')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Security' }));
    expect(screen.getByText('Change password card')).toBeInTheDocument();
  });
});
