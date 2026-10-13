import { describe, it, expect } from 'vitest';
import { departmentAdminHome, departmentAdminPath, isAdminArea } from '../departmentAdminPaths';

describe('departmentAdminHome', () => {
  it('puts the admin home under the department short name', () => {
    expect(departmentAdminHome('co')).toBe('/co/admin');
    expect(departmentAdminHome('ee')).toBe('/ee/admin');
  });

  it('falls back to the plain admin address without a short name', () => {
    expect(departmentAdminHome(undefined)).toBe('/admin');
    expect(departmentAdminHome('')).toBe('/admin');
  });
});

describe('departmentAdminPath', () => {
  it('moves admin paths under the department short name', () => {
    expect(departmentAdminPath('co', '/admin')).toBe('/co/admin');
    expect(departmentAdminPath('co', '/admin/results')).toBe('/co/admin/results');
    expect(departmentAdminPath('ee', '/admin/users/42/edit')).toBe('/ee/admin/users/42/edit');
  });

  it('leaves non-admin paths alone', () => {
    expect(departmentAdminPath('co', '/dashboard')).toBe('/dashboard');
    expect(departmentAdminPath('co', '/administration')).toBe('/administration');
  });

  it('keeps the plain path when the department has no short name', () => {
    expect(departmentAdminPath(undefined, '/admin/results')).toBe('/admin/results');
  });

  it('leaves an address that already has the short name unchanged', () => {
    expect(departmentAdminPath('co', '/co/admin')).toBe('/co/admin');
  });
});

describe('isAdminArea', () => {
  it('recognises both the plain and the department admin addresses', () => {
    expect(isAdminArea('/admin')).toBe(true);
    expect(isAdminArea('/admin/users')).toBe(true);
    expect(isAdminArea('/co/admin')).toBe(true);
    expect(isAdminArea('/ee/admin/results')).toBe(true);
  });

  it('does not treat other pages as the admin area', () => {
    expect(isAdminArea('/dashboard')).toBe(false);
    expect(isAdminArea('/administration')).toBe(false);
    expect(isAdminArea('/co')).toBe(false);
  });
});
