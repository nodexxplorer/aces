import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AttendanceCheckinPage from '../../student/AttendanceCheckinPage';
import * as api from '../../../api/verified-attendance';
vi.mock('../../../api/verified-attendance', () => ({
  attendanceDetail: vi.fn(),
  attendanceDevice: vi.fn(() => 'credential'),
  attendanceLocation: vi.fn(),
  submitVerifiedAttendance: vi.fn(),
}));
vi.mock('../../../hooks/useDashboardPath', () => ({ useDashboardPath: () => '/co/i/dashboard' }));
const show = (path = '/co/i/attendance/checkin?v=2&session=session#challenge=current') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AttendanceCheckinPage />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.attendanceDetail).mockResolvedValue({
    courseCode: 'CE101',
    session: { title: 'Lecture 1', venue: 'Hall', scheduled_at: '2026-11-05T09:00:00Z' },
    records: [],
    disputes: [],
    events: [],
    canManage: false,
    canOperate: false,
  } as unknown as api.AttendanceDetail);
  vi.mocked(api.attendanceLocation).mockResolvedValue(null);
  vi.mocked(api.submitVerifiedAttendance).mockResolvedValue({ verification: 'flagged' } as api.VerifiedRecord);
});
describe('Verified check-in', () => {
  it('does not submit automatically just by opening a link', async () => {
    show();
    expect(await screen.findByText(/CE101/)).toBeInTheDocument();
    expect(api.submitVerifiedAttendance).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Confirm presence/ })).toBeInTheDocument();
  });
  it('submits missing GPS for review, not as an absence', async () => {
    show();
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm presence/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Confirm presence/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('not an automatic absence');
    expect(api.submitVerifiedAttendance).toHaveBeenCalledWith('session', 'current', 'credential', null);
  });
  it('rejects legacy static session links', () => {
    show('/co/i/attendance/checkin?session=old');
    expect(screen.getByRole('alert')).toHaveTextContent('legacy or incomplete');
    expect(api.submitVerifiedAttendance).not.toHaveBeenCalled();
  });
  it('leaves expired-challenge errors retryable and does not claim presence', async () => {
    vi.mocked(api.submitVerifiedAttendance).mockRejectedValue({
      response: { data: { error: 'Code expired; scan again' } },
    });
    show();
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm presence/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Confirm presence/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Code expired'));
    expect(screen.getByRole('button', { name: /Confirm presence/ })).toBeEnabled();
  });
  it('does not describe an existing rejected record as verified on retry', async () => {
    vi.mocked(api.submitVerifiedAttendance).mockResolvedValue({
      verification: 'rejected',
      outcome: 'absent',
    } as api.VerifiedRecord);
    show();
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm presence/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Confirm presence/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('reviewed as absent');
  });
});
