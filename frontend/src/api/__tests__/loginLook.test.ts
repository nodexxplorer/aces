import { describe, expect, it } from 'vitest';
import { checkLoginImageFile, loginImageSrc, resolveLoginTemplate } from '../loginLook';

describe('resolveLoginTemplate', () => {
  it('uses classic when nothing is chosen', () => {
    expect(resolveLoginTemplate(undefined, false)).toBe('classic');
    expect(resolveLoginTemplate('classic', true)).toBe('classic');
  });

  it('uses split and centered when the department has an image', () => {
    expect(resolveLoginTemplate('split', true)).toBe('split');
    expect(resolveLoginTemplate('centered', true)).toBe('centered');
  });

  it('falls back to classic when split or centered has no image', () => {
    expect(resolveLoginTemplate('split', false)).toBe('classic');
    expect(resolveLoginTemplate('centered', false)).toBe('classic');
  });
});

describe('loginImageSrc', () => {
  it('is undefined without an image', () => {
    expect(loginImageSrc({ template: 'split' })).toBeUndefined();
    expect(loginImageSrc(undefined)).toBeUndefined();
  });

  it('joins the API path to the base address', () => {
    const src = loginImageSrc({ template: 'split', imageUrl: '/api/v1/tenants/co/login-image?v=1' });
    expect(src?.endsWith('/api/v1/tenants/co/login-image?v=1')).toBe(true);
  });
});

describe('checkLoginImageFile', () => {
  it('accepts PNG, JPEG and WebP up to 4 MB', () => {
    expect(checkLoginImageFile({ type: 'image/png', size: 1000 })).toBeUndefined();
    expect(checkLoginImageFile({ type: 'image/jpeg', size: 1000 })).toBeUndefined();
    expect(checkLoginImageFile({ type: 'image/webp', size: 4 * 1024 * 1024 })).toBeUndefined();
  });

  it('refuses SVG and other types', () => {
    expect(checkLoginImageFile({ type: 'image/svg+xml', size: 100 })).toMatch(/PNG, JPEG or WebP/);
    expect(checkLoginImageFile({ type: 'application/pdf', size: 100 })).toMatch(/PNG, JPEG or WebP/);
  });

  it('refuses files over 4 MB', () => {
    expect(checkLoginImageFile({ type: 'image/png', size: 4 * 1024 * 1024 + 1 })).toMatch(/4 MB/);
  });
});
