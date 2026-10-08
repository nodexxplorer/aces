import { describe, expect, it } from 'vitest';
import { departmentLogoUrl } from '../department';

describe('departmentLogoUrl', () => {
  it('returns undefined when the department has no logo', () => {
    expect(departmentLogoUrl(undefined)).toBeUndefined();
    expect(departmentLogoUrl('')).toBeUndefined();
  });

  it('joins the logo path to the API base address', () => {
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    expect(departmentLogoUrl('/api/v1/tenants/uniuyo-ce/logo')).toBe(`${base}/api/v1/tenants/uniuyo-ce/logo`);
  });
});
