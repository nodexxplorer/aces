import { afterEach, describe, it, expect } from 'vitest';
import { modoolsLoginUrl, takeModoolsPayload } from '../modools';

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

// The backend's RawURLEncoding: base64url, no padding, of the JSON payload.
function encodePayload(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const session = {
  user: { id: '1', email: 'student@example.test', firstName: 'Adébáyọ̀', onboardingCompleted: false },
  tokens: { accessToken: 'access', refreshToken: 'refresh' },
};

describe('takeModoolsPayload', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('reads the session from the fragment and clears the fragment', () => {
    window.history.replaceState(null, '', `/login#auth=${encodePayload(session)}`);
    const payload = takeModoolsPayload();
    expect(payload?.user.email).toBe('student@example.test');
    expect(payload?.user.firstName).toBe('Adébáyọ̀');
    expect(payload?.tokens.accessToken).toBe('access');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/login');
  });

  it('keeps the query string when it clears the fragment', () => {
    window.history.replaceState(null, '', `/login?next=%2Fdashboard#auth=${encodePayload(session)}`);
    takeModoolsPayload();
    expect(window.location.search).toBe('?next=%2Fdashboard');
    expect(window.location.hash).toBe('');
  });

  it('returns nothing when there is no session', () => {
    window.history.replaceState(null, '', '/login');
    expect(takeModoolsPayload()).toBeNull();
  });

  it('returns nothing for a session that cannot be read, and still clears it', () => {
    window.history.replaceState(null, '', '/login#auth=not-json-at-all');
    expect(takeModoolsPayload()).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('returns nothing when the session has no user or tokens', () => {
    window.history.replaceState(null, '', `/login#auth=${encodePayload({ user: session.user })}`);
    expect(takeModoolsPayload()).toBeNull();
  });
});
