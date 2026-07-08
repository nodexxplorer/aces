import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, getInitials } from '../formatters';

describe('formatCurrency', () => {
  it('formats NGN currency', () => {
    expect(formatCurrency(15000)).toContain('15');
  });
});

describe('getInitials', () => {
  it('returns initials from names', () => {
    expect(getInitials('John', 'Doe')).toBe('JD');
  });

  it('handles single character', () => {
    expect(getInitials('A', 'B')).toBe('AB');
  });
});

describe('formatDate', () => {
  it('formats date string', () => {
    const result = formatDate('2026-06-20T12:00:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
