import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDepartments } from '../useDepartments';
import { listDepartments, type Department } from '../../api/departments';

vi.mock('../../api/departments', () => ({
  listDepartments: vi.fn(),
}));

const departments: Department[] = [
  { slug: 'uniuyo-ce', name: 'Department of Computer Engineering', institution: 'University of Uyo', default: true },
  { slug: 'uniuyo-ee', name: 'Department of Electrical Engineering', institution: 'University of Uyo' },
];

// One client per test, so cached results never leak between tests.
function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useDepartments', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listDepartments).mockResolvedValue(departments);
  });

  it('selects the default department when nothing is remembered', async () => {
    const { result } = renderHook(() => useDepartments(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));
    expect(result.current.selected).toBe('uniuyo-ce');
  });

  it('keeps a remembered department that is still active', async () => {
    localStorage.setItem('aces_department', 'uniuyo-ee');
    const { result } = renderHook(() => useDepartments(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));
    expect(result.current.selected).toBe('uniuyo-ee');
  });

  it('falls back to the default when the remembered department is gone', async () => {
    localStorage.setItem('aces_department', 'retired-dept');
    const { result } = renderHook(() => useDepartments(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));
    expect(result.current.selected).toBe('uniuyo-ce');
  });

  it('remembers a new choice', async () => {
    const { result } = renderHook(() => useDepartments(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));

    act(() => result.current.select('uniuyo-ee'));

    expect(result.current.selected).toBe('uniuyo-ee');
    expect(localStorage.getItem('aces_department')).toBe('uniuyo-ee');
  });

  it('sends an empty selection while the list is still loading', () => {
    vi.mocked(listDepartments).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDepartments(), { wrapper: makeWrapper() });
    expect(result.current.selected).toBe('');
  });
});
