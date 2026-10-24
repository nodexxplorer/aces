import { describe, it, expect } from 'vitest';
import {
  ADMIN_GRANTS,
  CAPABILITIES,
  capabilitiesForPerson,
  capabilitiesForRole,
  capabilitiesForRoles,
} from '../permissions';

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

describe('capabilitiesForPerson (grants)', () => {
  const grantKeys = (list: { key: string }[]) => list.map((c) => c.key);

  it('gives a delegated admin with no grant none of the admin areas', () => {
    const got = grantKeys(capabilitiesForPerson(['delegated_admin'], null));
    expect(got).not.toContain('manage_users');
    expect(got).not.toContain('view_payments');
    expect(got).toEqual([]);
  });

  it('gives a delegated admin only the areas their grant names', () => {
    const got = grantKeys(capabilitiesForPerson(['delegated_admin'], { can_manage_finance: true }));
    expect(got).toEqual(expect.arrayContaining(['view_payments', 'verify_payments', 'manage_dues', 'view_defaulters']));
    expect(got).not.toContain('manage_users');
    expect(got).not.toContain('enter_scores');
  });

  it('gives the HOD everything without a grant', () => {
    expect(grantKeys(capabilitiesForPerson(['hod'], null))).toEqual(grantKeys(capabilitiesForRoles(['hod'])));
  });

  it('keeps a non-admin role on a grant holder', () => {
    const got = grantKeys(capabilitiesForPerson(['delegated_admin', 'lecturer'], null));
    expect(got).toEqual(expect.arrayContaining(['enter_scores']));
    expect(got).not.toContain('manage_users');
  });

  it('gives a student their own capabilities regardless of grants', () => {
    expect(grantKeys(capabilitiesForPerson(['student'], null))).toEqual(['pay_dues', 'sign_course_forms']);
  });

  it('covers every grant flag with a capability, so no grant is shown without a control', () => {
    const grants = new Set(CAPABILITIES.map((c) => c.grant).filter(Boolean));
    for (const g of ADMIN_GRANTS) expect(grants.has(g.key)).toBe(true);
  });
});
