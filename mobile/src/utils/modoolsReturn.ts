// Reads the result of a Modools sign-in from the app's return address,
// aceszone://modools-complete. A success carries a one-time code in the query.
// The app trades it for the session at the server, with its PKCE verifier. A
// failure carries an error code in the query instead. The session is never in
// the address.

export type ModoolsReturn = { kind: 'code'; code: string } | { kind: 'error'; code: string } | { kind: 'invalid' };

/** A one-time code is 32 random bytes as base64url, which is 43 characters. */
const CODE_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** One query parameter, decoded. Null when it is absent. */
function readQueryParam(url: string, name: string): string | null {
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const queryAt = beforeHash.indexOf('?');
  if (queryAt < 0) return null;
  for (const pair of beforeHash.slice(queryAt + 1).split('&')) {
    const eq = pair.indexOf('=');
    try {
      const key = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      if (key === name) {
        return decodeURIComponent((eq >= 0 ? pair.slice(eq + 1) : '').replace(/\+/g, ' '));
      }
    } catch {
      // A malformed escape cannot be the parameter we are looking for.
    }
  }
  return null;
}

export function parseModoolsReturn(url: string): ModoolsReturn {
  const error = readQueryParam(url, 'error');
  if (error) return { kind: 'error', code: error };
  const code = readQueryParam(url, 'code');
  if (code && CODE_SHAPE.test(code)) return { kind: 'code', code };
  return { kind: 'invalid' };
}
