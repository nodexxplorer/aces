import { Suspense } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DepartmentEntry from '../DepartmentEntry';
import { listDepartments } from '../../../api/departments';

vi.mock('../../../api/departments', () => ({
  listDepartments: vi.fn(),
}));

// The two sign-in pages are stubbed: these tests are about which page an
// address opens and which department it passes on.
vi.mock('../LoginPage', async () => {
  const React = await import('react');
  return {
    default: ({ urlCode }: { urlCode?: string }) => React.createElement('p', null, `student sign-in for ${urlCode}`),
  };
});
vi.mock('../StaffPortalLoginPage', async () => {
  const React = await import('react');
  return {
    default: ({ urlCode }: { urlCode?: string }) => React.createElement('p', null, `staff sign-in for ${urlCode}`),
  };
});

const departments = [
  { slug: 'uniuyo-ce', name: 'Department of Computer Engineering', urlCode: 'co', default: true },
  { slug: 'dept-ee', name: 'Department of Electrical Engineering', urlCode: 'ee' },
];

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {/* The router wraps these routes in a suspense boundary; the test does the same. */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/:code" element={<DepartmentEntry admin={false} />} />
            <Route path="/:code/admin" element={<DepartmentEntry admin />} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('department sign-in addresses', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listDepartments).mockResolvedValue(departments);
  });

  it('/:code opens the student sign-in for that department', async () => {
    renderAt('/co');
    expect(await screen.findByText('student sign-in for co')).toBeInTheDocument();
  });

  it('/:code/admin opens the staff sign-in for that department', async () => {
    renderAt('/ee/admin');
    expect(await screen.findByText('staff sign-in for ee')).toBeInTheDocument();
  });

  it('an address that names no department shows the not-found page', async () => {
    renderAt('/zz');
    expect(await screen.findByText('404')).toBeInTheDocument();
  });

  it('an unknown code on the admin address shows the not-found page too', async () => {
    renderAt('/zz/admin');
    expect(await screen.findByText('404')).toBeInTheDocument();
  });
});
