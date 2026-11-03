import { describe, it, expect } from 'vitest';
import {
  departmentAdminHome,
  departmentAdminPath,
  departmentDashboardPath,
  departmentProfilePath,
  isAdminArea,
  roleSegment,
  tenantPath,
} from '../departmentAdminPaths';

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

describe('role areas', () => {
  it('gives each role its segment', () => {
    expect(roleSegment('hod')).toBe('admin');
    expect(roleSegment('admin')).toBe('admin');
    expect(roleSegment('student')).toBe('i');
    expect(roleSegment('lecturer')).toBe('l');
    expect(roleSegment('class_rep')).toBe('rep');
    expect(roleSegment('class_bursar')).toBe('bu');
    expect(roleSegment('dept_bursar')).toBe('bu');
  });

  it('puts every role page under the short name', () => {
    expect(tenantPath('co', '/i/payments')).toBe('/co/i/payments');
    expect(tenantPath('co', '/l/class-list?x=1')).toBe('/co/l/class-list?x=1');
    expect(tenantPath('co', '/rep/pending')).toBe('/co/rep/pending');
    expect(tenantPath('co', '/bu/verify')).toBe('/co/bu/verify');
  });

  it('leaves shared pages alone', () => {
    expect(tenantPath('co', '/notifications')).toBe('/notifications');
    expect(tenantPath('co', '/connect')).toBe('/connect');
    expect(tenantPath('co', '/support')).toBe('/support');
    expect(tenantPath(undefined, '/i/payments')).toBe('/i/payments');
  });

  it('builds the dashboard and profile addresses for each role', () => {
    expect(departmentDashboardPath('co', 'student')).toBe('/co/i/dashboard');
    expect(departmentDashboardPath('co', 'lecturer')).toBe('/co/l/dashboard');
    expect(departmentDashboardPath('co', 'class_rep')).toBe('/co/rep/dashboard');
    expect(departmentDashboardPath('co', 'dept_bursar')).toBe('/co/bu/dashboard');
    expect(departmentDashboardPath('co', 'hod')).toBe('/co/admin/dashboard');
    expect(departmentProfilePath('co', 'lecturer')).toBe('/co/l/profile');
    expect(departmentProfilePath('co', 'hod')).toBe('/co/admin/profile');
    expect(departmentProfilePath('co', 'student')).toBe('/co/i/profile');
  });
});
