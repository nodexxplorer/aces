import { describe, it, expect } from 'vitest';
import { departmentByUrlCode, departmentSignInPath, STAFF_LOGIN_PATH } from '../department';

const departments = [
  { slug: 'uniuyo-ce', name: 'Department of Computer Engineering', urlCode: 'co' },
  { slug: 'dept-ee', name: 'Department of Electrical Engineering', urlCode: 'ee' },
  { slug: 'dept-old', name: 'Department without a code' },
];

describe('departmentByUrlCode', () => {
  it('finds the department whose code is named, whatever the case', () => {
    expect(departmentByUrlCode(departments, 'co')?.slug).toBe('uniuyo-ce');
    expect(departmentByUrlCode(departments, 'EE')?.slug).toBe('dept-ee');
  });

  it('finds nothing for a missing, empty or unknown code', () => {
    expect(departmentByUrlCode(departments, undefined)).toBeUndefined();
    expect(departmentByUrlCode(departments, '')).toBeUndefined();
    expect(departmentByUrlCode(departments, 'zz')).toBeUndefined();
  });

  it('never matches a department that has no code', () => {
    expect(departmentByUrlCode(departments, 'undefined')).toBeUndefined();
  });
});

describe('departmentSignInPath', () => {
  it("gives a department's own student and admin addresses", () => {
    expect(departmentSignInPath({ urlCode: 'co' }, false)).toBe('/co');
    expect(departmentSignInPath({ urlCode: 'co' }, true)).toBe('/co/admin');
  });

  it('falls back to the generic sign-in pages for a department with no code', () => {
    expect(departmentSignInPath({}, false)).toBe('/login');
    expect(departmentSignInPath({}, true)).toBe(STAFF_LOGIN_PATH);
    expect(departmentSignInPath(undefined, true)).toBe(STAFF_LOGIN_PATH);
  });

  it('keeps the hidden staff portal path at /login under it', () => {
    expect(STAFF_LOGIN_PATH.endsWith('/login')).toBe(true);
  });
});
