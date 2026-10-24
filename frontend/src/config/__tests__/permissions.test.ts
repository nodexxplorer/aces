import { describe, it, expect } from 'vitest';
import { capabilitiesForRole, capabilitiesForRoles } from '../permissions';

const keys = (list: { key: string }[]) => list.map((c) => c.key).sort();

describe('permissions', () => {
  it('lists what one role grants', () => {
    expect(keys(capabilitiesForRole('class_rep'))).toEqual(
      ['approve_registrations', 'notify_classmates', 'view_class_list'].sort(),
    );
  });

  it('gives a person the union of their roles, including extra roles', () => {
    // A student who also holds class rep and class bursar.
    const perms = keys(capabilitiesForRoles(['student', 'class_rep', 'class_bursar']));
    expect(perms).toContain('pay_dues');
    expect(perms).toContain('approve_registrations');
    expect(perms).toContain('verify_payments');
    expect(perms).not.toContain('manage_users');
  });

  it('gives no capabilities to a role with none', () => {
    expect(capabilitiesForRoles(['alumni'])).toEqual([]);
  });
});
