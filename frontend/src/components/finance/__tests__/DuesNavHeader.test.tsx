import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DuesNavHeader } from '../DuesNavHeader';

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { tenant: { urlCode: 'co' } } }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DuesNavHeader activeTab="dues" />
    </MemoryRouter>,
  );
}

describe('DuesNavHeader tabs', () => {
  it('shows the admin tabs in the admin area', () => {
    renderAt('/co/admin/duesmanagement');
    expect(screen.getByRole('button', { name: 'Revenue forecast' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
  });

  it('shows the bursar tabs, with Verify in place of Revenue forecast, in the bursar area', () => {
    renderAt('/co/bu/dues');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revenue forecast' })).not.toBeInTheDocument();
  });
});
