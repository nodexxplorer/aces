import type { AuthTokens, AuthUser } from '../store/authStore';

// Reads the result of a Modools sign-in from the app's return address
// (aceszone://modools-complete; the backend sends it there when the sign-in
// started with client=mobile). A success carries the session in the fragment,
// as base64url JSON of {user, tokens}, the same payload the website receives.
// A failure carries an error code in the query.

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Bytes of base64 in either alphabet, padded or not. */
function base64ToBytes(input: string): number[] {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const value = BASE64.indexOf(ch);
    if (value < 0) throw new Error('not base64');
    buffer = ((buffer << 6) | value) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return out;
}

/** UTF-8 bytes to text, so names with accents come through unchanged. */
function utf8ToText(bytes: number[]): string {
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

/** One query or fragment parameter, decoded. Null when it is absent. */
function readParam(source: string, name: string): string | null {
  for (const pair of source.split('&')) {
    const eq = pair.indexOf('=');
    try {
      const key = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      if (key === name) return eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
    } catch {
      // A malformed escape cannot be the parameter we are looking for.
    }
  }
  return null;
}

export type ModoolsReturn =
  | { kind: 'session'; user: AuthUser; tokens: AuthTokens }
  | { kind: 'error'; code: string }
  | { kind: 'invalid' };

export function parseModoolsReturn(url: string): ModoolsReturn {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const fragment = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const queryAt = beforeHash.indexOf('?');
  const query = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '';

  const error = readParam(query, 'error');
  if (error) return { kind: 'error', code: error };

  const auth = readParam(fragment, 'auth');
  if (!auth) return { kind: 'invalid' };
  try {
    const parsed = JSON.parse(utf8ToText(base64ToBytes(auth)));
    if (parsed?.user && parsed?.tokens) return { kind: 'session', user: parsed.user, tokens: parsed.tokens };
    return { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}
