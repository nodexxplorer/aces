import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DepartmentLogo } from '../DepartmentBrand';

const NAME = 'Department of Electrical Engineering';
const LOGO = '/api/v1/tenants/dept-ee/logo';

describe('DepartmentLogo', () => {
  it('shows the logo image when the department has one', () => {
    render(<DepartmentLogo department={{ name: NAME, logoUrl: LOGO }} />);
    const img = screen.getByRole('img', { name: `${NAME} logo` });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toContain(LOGO);
  });

  it('shows the neutral badge when the department has no logo', () => {
    render(<DepartmentLogo department={{ name: NAME }} />);
    const badge = screen.getByRole('img', { name: NAME });
    expect(badge.tagName).toBe('DIV');
    expect(screen.queryByRole('img', { name: `${NAME} logo` })).toBeNull();
  });

  it('falls back to the badge when the logo cannot be loaded', () => {
    render(<DepartmentLogo department={{ name: NAME, logoUrl: LOGO }} />);
    fireEvent.error(screen.getByRole('img', { name: `${NAME} logo` }));
    expect(screen.queryByRole('img', { name: `${NAME} logo` })).toBeNull();
    expect(screen.getByRole('img', { name: NAME }).tagName).toBe('DIV');
  });

  it('tries a different logo after one has failed', () => {
    const { rerender } = render(<DepartmentLogo department={{ name: NAME, logoUrl: LOGO }} />);
    fireEvent.error(screen.getByRole('img', { name: `${NAME} logo` }));
    rerender(<DepartmentLogo department={{ name: NAME, logoUrl: '/api/v1/tenants/uniuyo-ce/logo' }} />);
    const img = screen.getByRole('img', { name: `${NAME} logo` });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toContain('/api/v1/tenants/uniuyo-ce/logo');
  });
});
