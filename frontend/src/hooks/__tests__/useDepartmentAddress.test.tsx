import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDepartments } from '../useDepartments';
import { listDepartments, type Department } from '../../api/departments';

vi.mock('../../api/departments', () => ({
  listDepartments: vi.fn(),
}));

const departments: Department[] = [
  { slug: 'uniuyo-ce', name: 'Department of Computer Engineering', urlCode: 'co', default: true },
  { slug: 'dept-ee', name: 'Department of Electrical Engineering', urlCode: 'ee', accentColor: '#1b65a7' },
];

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useDepartments with a department address', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(listDepartments).mockResolvedValue(departments);
  });

  it('chooses the department the address names, ahead of the remembered choice', async () => {
    localStorage.setItem('aces_department', 'uniuyo-ce');
    const { result } = renderHook(() => useDepartments('ee'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));
    expect(result.current.selected).toBe('dept-ee');
    expect(localStorage.getItem('aces_department')).toBe('dept-ee');
  });

  it('matches the code whatever its case', async () => {
    const { result } = renderHook(() => useDepartments('EE'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));
    expect(result.current.selected).toBe('dept-ee');
  });

  it('falls back to the remembered choice when the address names no department', async () => {
    localStorage.setItem('aces_department', 'dept-ee');
    const { result } = renderHook(() => useDepartments('zz'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));
    expect(result.current.selected).toBe('dept-ee');
  });

  it('applies the accent of the chosen department, and the platform colour when it has none', async () => {
    const { result } = renderHook(() => useDepartments('ee'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.selected).toBe('dept-ee'));
    expect(document.documentElement.style.getPropertyValue('--primary-500')).toBe('27 101 167');

    const { result: other } = renderHook(() => useDepartments('co'), { wrapper: makeWrapper() });
    await waitFor(() => expect(other.current.selected).toBe('uniuyo-ce'));
    expect(document.documentElement.style.getPropertyValue('--primary-500')).toBe('');
  });

  it('uses the address department when nothing is remembered yet', async () => {
    const { result } = renderHook(() => useDepartments('co'), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.departments).toHaveLength(2));
    expect(result.current.selected).toBe('uniuyo-ce');
  });
});
