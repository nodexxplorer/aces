import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantInfo } from '../../../types';
import WaitingDashboardPage from '../WaitingDashboardPage';

const shared = vi.hoisted(() => ({
  department: undefined as TenantInfo | undefined,
  updateUser: vi.fn(),
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      firstName: 'Ada',
      lastName: 'Okafor',
      matricNumber: '20/EG/EE/1234',
      level: 200,
      isApproved: false,
      isActive: true,
    },
    updateUser: shared.updateUser,
  }),
}));

vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../api/auth', () => ({
  getMe: vi.fn(async () => null),
}));

vi.mock('../../../components/branding/department', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../components/branding/department')>()),
  useCurrentDepartment: () => shared.department,
}));

const electrical: TenantInfo = {
  slug: 'dept-ee',
  name: 'Department of Electrical Engineering',
  institution: 'University of Uyo',
  contactEmail: 'receipts@example.edu',
  approvalContactEmail: 'ee-office@example.edu',
};

const mailtoLinks = () =>
  screen.queryAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('mailto:'));

describe('WaitingDashboardPage', () => {
  beforeEach(() => {
    shared.department = electrical;
  });

  it("names the student's own department, never another one", () => {
    render(<WaitingDashboardPage />);
    expect(screen.getByText('Your account is being reviewed by Department of Electrical Engineering.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Computer Engineering');
    expect(document.body.textContent).not.toContain('ACES');
  });

  it('links to the approval address, not the receipts contact, with a prefilled subject', () => {
    render(<WaitingDashboardPage />);
    const links = mailtoLinks();
    expect(links).toHaveLength(1);
    const href = links[0].getAttribute('href') ?? '';
    expect(href.startsWith('mailto:ee-office@example.edu?subject=')).toBe(true);
    expect(href).toContain(encodeURIComponent('Registration inquiry - Department of Electrical Engineering'));
  });

  it("shows the footer line from the student's own name and institution", () => {
    render(<WaitingDashboardPage />);
    expect(screen.getByText('Department of Electrical Engineering · University of Uyo')).toBeTruthy();
  });

  it('puts the department before the title, so the page opens on whose approval it is', () => {
    render(<WaitingDashboardPage />);
    const name = screen.getAllByText('Department of Electrical Engineering')[0];
    const title = screen.getByText('Waiting for Approval');
    expect(name.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers no mailto link, and says so, when the department has no contact address', () => {
    shared.department = { ...electrical, approvalContactEmail: undefined };
    render(<WaitingDashboardPage />);
    expect(mailtoLinks()).toHaveLength(0);
    expect(screen.getByText('Contact your department office for help.')).toBeTruthy();
  });
});
