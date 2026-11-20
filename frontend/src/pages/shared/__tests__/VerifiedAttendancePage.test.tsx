import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VerifiedAttendancePage from '../VerifiedAttendancePage';
import * as api from '../../../api/verified-attendance';

vi.mock('../../../api/verified-attendance', () => ({
  attendanceCatalog: vi.fn(),
  attendanceSessions: vi.fn(),
  attendanceDetail: vi.fn(),
  attendanceAction: vi.fn(),
  attendanceCode: vi.fn(),
  attendanceEligibility: vi.fn(),
  attendanceSnapshots: vi.fn(),
  publishAttendanceSnapshot: vi.fn(),
  createVerifiedSession: vi.fn(),
  attendanceLocation: vi.fn(),
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'student', tenant: { urlCode: 'co' } } }),
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr') } }));
const course = {
  id: 'course',
  semester_id: 'semester',
  code: 'CE101',
  title: 'Engineering',
  semester: 'harmattan',
  can_manage: true,
};
const session: api.VerifiedSession = {
  id: 'session',
  course_id: 'course',
  semester_id: 'semester',
  lecturer_id: 'lecturer',
  delegate_id: null,
  title: 'Lecture 1',
  venue: 'Hall',
  scheduled_at: '2026-11-05T09:00:00Z',
  duration_minutes: 15,
  closes_at: null,
  status: 'closed',
  revision: 1,
};
const detail: api.AttendanceDetail = {
  session,
  canManage: true,
  canOperate: true,
  records: [
    {
      user_id: 'student',
      name: 'Jane',
      matric: 'EG/001',
      verification: 'flagged',
      outcome: 'present',
      flags: ['location_uncertain'],
      submitted_at: '2026-11-05T09:00:00Z',
      revision: 1,
      review_reason: null,
    },
  ],
  disputes: [],
  events: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.attendanceCatalog).mockResolvedValue({ courses: [course], policyVersion: 'pilot-session-75-v1' });
  vi.mocked(api.attendanceSessions).mockResolvedValue([session]);
  vi.mocked(api.attendanceDetail).mockResolvedValue(detail);
  vi.mocked(api.attendanceEligibility).mockResolvedValue({
    policyVersion: 'pilot-session-75-v1',
    threshold: 75,
    pilot: true,
    results: [
      {
        user_id: 'student',
        name: 'Jane',
        matric: 'EG/001',
        credited: 3,
        total: 4,
        pending: 0,
        percentage: 75,
        decision: 'eligible',
      },
    ],
  });
  vi.mocked(api.attendanceSnapshots).mockResolvedValue([]);
  vi.mocked(api.attendanceAction).mockResolvedValue({});
});
describe('Verified attendance', () => {
  it('shows exact finalized-course eligibility and the pilot warning', async () => {
    render(<VerifiedAttendancePage />);
    expect(await screen.findByText('75.00%')).toBeInTheDocument();
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(screen.getByText(/does not automatically bar/)).toBeInTheDocument();
  });
  it('requires held-lecture confirmation before finalizing', async () => {
    render(<VerifiedAttendancePage />);
    fireEvent.click(await screen.findByRole('button', { name: /Lecture 1/ }));
    const finalize = await screen.findByRole('button', { name: /Finalize official/ });
    expect(finalize).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /lecture was actually held/ }));
    fireEvent.click(finalize);
    await waitFor(() => expect(api.attendanceAction).toHaveBeenCalledWith('session', 'finalize', { held: true }));
  });
  it('keeps unassigned students out of management controls and allows disputes', async () => {
    vi.mocked(api.attendanceCatalog).mockResolvedValue({
      courses: [{ ...course, can_manage: false }],
      policyVersion: 'pilot-session-75-v1',
    });
    vi.mocked(api.attendanceDetail).mockResolvedValue({ ...detail, canManage: false, canOperate: false });
    render(<VerifiedAttendancePage />);
    fireEvent.click(await screen.findByRole('button', { name: /Lecture 1/ }));
    const reason = await screen.findByLabelText(/Report a missing/);
    fireEvent.change(reason, { target: { value: 'GPS failed in the lecture hall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit dispute' }));
    await waitFor(() =>
      expect(api.attendanceAction).toHaveBeenCalledWith('session', 'dispute', {
        reason: 'GPS failed in the lecture hall',
      }),
    );
    expect(screen.queryByRole('button', { name: /Create draft/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publish pilot/ })).not.toBeInTheDocument();
  });
  it('renders pending review rather than an academic rejection', async () => {
    vi.mocked(api.attendanceEligibility).mockResolvedValue({
      policyVersion: 'pilot-session-75-v1',
      threshold: 75,
      pilot: true,
      results: [
        {
          user_id: 'student',
          name: 'Jane',
          matric: 'EG/001',
          credited: 0,
          total: 1,
          pending: 1,
          percentage: 0,
          decision: 'pending_review',
        },
      ],
    });
    render(<VerifiedAttendancePage />);
    expect(await screen.findByText('pending review')).toBeInTheDocument();
    expect(screen.queryByText('not eligible')).not.toBeInTheDocument();
  });
  it('reports backend failures instead of implying a successful save', async () => {
    vi.mocked(api.attendanceAction).mockRejectedValue({ response: { data: { error: 'Unresolved reviews remain' } } });
    render(<VerifiedAttendancePage />);
    fireEvent.click(await screen.findByRole('button', { name: /Lecture 1/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /lecture was actually held/ }));
    fireEvent.click(screen.getByRole('button', { name: /Finalize official/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unresolved reviews remain');
  });
});
