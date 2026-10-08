import { describe, expect, it } from 'vitest';
import { alumniLabel, assistantName, departmentShortName } from '../department';

describe('department names', () => {
  it('drops the "Department of" prefix', () => {
    expect(departmentShortName('Department of Computer Engineering')).toBe('Computer Engineering');
    expect(departmentShortName('department of  Electrical Engineering ')).toBe('Electrical Engineering');
  });

  it('has no short name without a name', () => {
    expect(departmentShortName(undefined)).toBeUndefined();
    expect(departmentShortName('   ')).toBeUndefined();
  });

  it("names the assistant for the student's department, or for the platform", () => {
    expect(assistantName({ name: 'Department of Electrical Engineering' })).toBe('Electrical Engineering Assistant');
    expect(assistantName(undefined)).toBe('Admin Pack Assistant');
  });

  it("names the department's alumni", () => {
    expect(alumniLabel({ name: 'Department of Computer Engineering' })).toBe('Computer Engineering alumni');
    expect(alumniLabel(undefined)).toBe('alumni');
  });
});
