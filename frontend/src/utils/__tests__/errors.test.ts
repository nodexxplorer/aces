import { describe, expect, it } from 'vitest';
import { getErrorDepartment, getErrorMessage } from '../errors';

describe('getErrorDepartment', () => {
  it('returns the department a matric refusal names', () => {
    const err = {
      response: {
        data: {
          error: 'This matric number belongs to Department of Electrical Engineering.',
          department: { slug: 'dept-ee', name: 'Department of Electrical Engineering' },
        },
      },
    };
    expect(getErrorDepartment(err)).toEqual({
      slug: 'dept-ee',
      name: 'Department of Electrical Engineering',
    });
  });

  it('returns null when the refusal names no department', () => {
    expect(getErrorDepartment({ response: { data: { error: 'Matric numbers look like 20/EG/CO/1234.' } } })).toBeNull();
  });

  it('returns null when the department is incomplete', () => {
    expect(getErrorDepartment({ response: { data: { department: { slug: 'dept-ee' } } } })).toBeNull();
    expect(getErrorDepartment({ response: { data: { department: { slug: '', name: 'Electrical' } } } })).toBeNull();
  });

  it('tolerates values that are not server errors', () => {
    expect(getErrorDepartment(null)).toBeNull();
    expect(getErrorDepartment(undefined)).toBeNull();
    expect(getErrorDepartment('network down')).toBeNull();
    expect(getErrorDepartment({ response: { data: '<html>502</html>' } })).toBeNull();
    expect(getErrorDepartment(new Error('boom'))).toBeNull();
  });

  it('leaves the message helper unchanged', () => {
    expect(getErrorMessage({ response: { data: { error: 'nope' } } })).toBe('nope');
  });
});
