import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getStoredDepartment, storeDepartment } from '../department';

describe('department storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty string when nothing has been chosen', () => {
    expect(getStoredDepartment()).toBe('');
  });

  it('remembers the chosen department slug', () => {
    storeDepartment('uniuyo-ee');
    expect(getStoredDepartment()).toBe('uniuyo-ee');
  });

  it('falls back to the default when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(getStoredDepartment()).toBe('');
  });

  it('does not throw when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => storeDepartment('uniuyo-ee')).not.toThrow();
  });
});
