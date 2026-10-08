import { describe, it, expect } from 'vitest';
import { modoolsLoginUrl } from '../modools';

describe('modoolsLoginUrl', () => {
  it('starts the Modools login without a department when none is given', () => {
    expect(modoolsLoginUrl()).toMatch(/\/auth\/modools\/login$/);
  });

  it('passes the chosen department as the tenant query parameter', () => {
    expect(modoolsLoginUrl('uniuyo-ee')).toMatch(/\/auth\/modools\/login\?tenant=uniuyo-ee$/);
  });

  it('encodes the department slug', () => {
    expect(modoolsLoginUrl('a b&c')).toMatch(/\?tenant=a%20b%26c$/);
  });
});
