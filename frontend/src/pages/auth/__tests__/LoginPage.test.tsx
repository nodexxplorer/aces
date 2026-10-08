import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { listDepartments } from '../../../api/departments';

vi.mock('../../../api/departments', () => ({
  listDepartments: vi.fn(),
}));

vi.mock('../../../api/modools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/modools')>();
  return { ...actual, getModoolsStatus: vi.fn().mockResolvedValue({ configured: true }) };
});

const departments = [
  { slug: 'uniuyo-ce', name: 'Department of Computer Engineering', institution: 'University of Uyo', default: true },
  { slug: 'unilag-ce', name: 'Department of Computer Engineering', institution: 'University of Lagos' },
];

function renderLogin(initialEntry = '/login') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('student sign-in page', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listDepartments).mockClear();
    vi.mocked(listDepartments).mockResolvedValue(departments);
  });

  it('offers every active department, with the default selected', async () => {
    renderLogin();
    const select = await screen.findByLabelText('Department');
    await waitFor(() => expect(select.querySelectorAll('option')).toHaveLength(2));
    expect(select).toHaveValue('uniuyo-ce');
    expect(
      screen.getByRole('option', { name: 'Department of Computer Engineering, University of Lagos' }),
    ).toBeInTheDocument();
  });

  it('explains when the chosen department cannot be used', async () => {
    renderLogin('/login?error=unknown_department');
    expect(
      await screen.findByText('That department is not available for sign-in. Choose another department.'),
    ).toBeInTheDocument();
  });

  it('hides the picker when there is only one department', async () => {
    vi.mocked(listDepartments).mockResolvedValue([departments[0]]);
    renderLogin();
    await waitFor(() => expect(listDepartments).toHaveBeenCalledTimes(1));
    // Let the resolved list reach the page before checking that no picker shows.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
  });
});
