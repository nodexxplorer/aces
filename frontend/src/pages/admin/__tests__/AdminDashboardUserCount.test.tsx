import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from '../AdminDashboard';
import * as analytics from '../../../api/analytics';
import * as users from '../../../api/users';

vi.mock('../../../api/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/analytics')>();
  return { ...actual, getDashboardAnalytics: vi.fn() };
});
vi.mock('../../../api/users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/users')>();
  return { ...actual, getUsers: vi.fn(), getPendingApprovals: vi.fn() };
});
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { firstName: 'Admin', role: 'hod', activeRole: 'hod', tenant: { urlCode: 'co' } } }),
}));

describe('AdminDashboard user total', () => {
  it('shows the server total, not the length of the first page of users', async () => {
    vi.mocked(analytics.getDashboardAnalytics).mockResolvedValue({
      totalStudents: 150,
      totalLecturers: 10,
      totalCourses: 0,
      totalResults: 0,
      averageCGPA: 0,
      paymentCollected: 0,
      pendingApprovals: 0,
      activeComplaints: 0,
      registrationTrend: [],
      gradeDistribution: [],
      paymentTrend: [],
      topCourses: [],
    } as never);
    const page = Array.from({ length: 100 }, (_, i) => ({
      id: `u${i}`,
      role: 'student',
      level: 100,
      createdAt: new Date().toISOString(),
    }));
    vi.mocked(users.getUsers).mockResolvedValue(page as never);
    vi.mocked(users.getPendingApprovals).mockResolvedValue([] as never);

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByText('160').length).toBeGreaterThan(0));
  });
});
