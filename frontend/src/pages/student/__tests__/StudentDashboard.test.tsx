import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StudentDashboard from '../StudentDashboard';
import { getStudentDashboard } from '../../../api/dashboard';

vi.mock('../../../api/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/dashboard')>();
  return { ...actual, getStudentDashboard: vi.fn() };
});
// A stable user object, as the auth store provides; a new object on every render would refetch endlessly.
const mockUser = { firstName: 'Ada', lastName: 'Eze', matricNumber: 'ENG/2021/001' };
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentDashboard />
    </MemoryRouter>,
  );
}

describe('student dashboard when data cannot be loaded', () => {
  beforeEach(() => {
    vi.mocked(getStudentDashboard).mockReset();
  });

  it('shows a retry message instead of invented student details', async () => {
    vi.mocked(getStudentDashboard).mockRejectedValue(new Error('offline'));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText(/Good standing/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4\.35/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Level 500/)).not.toBeInTheDocument();
  });

  it('loads again when Try again is pressed', async () => {
    vi.mocked(getStudentDashboard).mockRejectedValue(new Error('offline'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(getStudentDashboard).toHaveBeenCalledTimes(2));
  });

  it('measures paid dues against the semester total', async () => {
    const dashboard = {
      student: { full_name: 'Ada Eze', matric_number: 'ENG/2021/001', level: 200, cgpa: null, academic_standing: null },
      attendance: { total_classes: 0, attended: 0, attendance_rate: 0 },
      payments: {
        amount_pending: 0,
        amount_paid: 900000,
        dues_outstanding: 1,
        semester_dues_total: 100000,
        semester_amount_paid: 50000,
      },
      announcements: [],
      recent_grades: [],
      notifications: { total: 0, unread: 0 },
    };
    vi.mocked(getStudentDashboard).mockResolvedValue(
      dashboard as unknown as Awaited<ReturnType<typeof getStudentDashboard>>,
    );
    renderPage();

    expect((await screen.findAllByText('Paid this semester')).length).toBeGreaterThan(0);
    // Semester paid and the 50,000 still owed are shown; the all-time 900,000 is not used for the gauge.
    expect(screen.getAllByText('₦50,000').length).toBeGreaterThan(0);
    expect(screen.queryByText('₦900,000')).not.toBeInTheDocument();
  });
});
