import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { listDepartments } from '../../../api/departments';
import { modoolsLoginUrl } from '../../../api/modools';

vi.mock('../../../api/departments', () => ({
  listDepartments: vi.fn(),
}));

vi.mock('../../../api/modools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/modools')>();
  return {
    ...actual,
    getModoolsStatus: vi.fn().mockResolvedValue({ configured: true }),
    modoolsLoginUrl: vi.fn((tenant?: string) => `https://modools.test/start?tenant=${tenant ?? ''}`),
  };
});

const departments = [
  {
    slug: 'uniuyo-ce',
    name: 'Department of Computer Engineering',
    institution: 'University of Uyo',
    default: true,
    urlCode: 'co',
  },
  {
    slug: 'unilag-ee',
    name: 'Department of Electrical Engineering',
    institution: 'University of Lagos',
    urlCode: 'ee',
  },
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
    vi.mocked(listDepartments).mockReset();
    vi.mocked(listDepartments).mockResolvedValue(departments);
    vi.mocked(modoolsLoginUrl).mockClear();
  });

  it('shows the welcome heading, subtitle and the sign-up link', async () => {
    renderLogin();
    expect(await screen.findByRole('heading', { name: /Welcome to/i })).toBeInTheDocument();
    expect(screen.getByText(/Select your engineering department/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/signup/student');
    expect(await screen.findByRole('button', { name: 'Continue with Modools' })).toBeEnabled();
  });

  it('has no email, password, forgot-password or footer on the student page', async () => {
    renderLogin();
    await screen.findByRole('button', { name: 'Continue with Modools' });
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign-in look|background|look/i })).not.toBeInTheDocument();
  });

  it('allows picking a department through the selector and continuing with Modools', async () => {
    renderLogin();
    const dropdownTrigger = await screen.findByRole('button', { name: /select department|faculty of engineering/i });
    expect(dropdownTrigger).toBeInTheDocument();

    fireEvent.click(dropdownTrigger);
    const electricalOption = await screen.findByText('Electrical Engineering');
    fireEvent.click(electricalOption);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Modools' }));
    expect(modoolsLoginUrl).toHaveBeenCalledWith('unilag-ee');
  });

  it('explains when the chosen department cannot be used', async () => {
    renderLogin('/login?error=unknown_department');
    expect(
      await screen.findByText('That department is not available for sign-in. Choose another department.'),
    ).toBeInTheDocument();
  });

  it('keeps the button text when Modools is unavailable', async () => {
    const { getModoolsStatus } = await import('../../../api/modools');
    vi.mocked(getModoolsStatus).mockResolvedValueOnce({ configured: false } as never);
    renderLogin();
    const button = await screen.findByRole('button', { name: 'Modools sign-in unavailable' });
    expect(button).toBeDisabled();
  });

  it('hides the picker when there is only one department', async () => {
    vi.mocked(listDepartments).mockResolvedValue([departments[0]]);
    renderLogin();
    await waitFor(() => expect(listDepartments).toHaveBeenCalledTimes(1));
    // Let the resolved list reach the page before checking that no picker shows.
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(screen.queryByRole('group', { name: 'Choose your department' })).not.toBeInTheDocument();
  });
});
