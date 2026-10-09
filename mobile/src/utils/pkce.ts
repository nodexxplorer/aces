// PKCE (RFC 7636) for the Modools sign-in in the browser. The app keeps the
// verifier and sends only its challenge, the SHA-256 of the verifier. The
// one-time code that comes back works only with the verifier, so another app
// that receives the return address cannot turn the code into a session.

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** The two platform calls a PKCE pair needs. The app passes expo-crypto's. */
export interface PkceCrypto {
  /** n cryptographically random bytes. */
  randomBytes: (n: number) => Uint8Array;
  /** SHA-256 of the text, as standard base64 with padding. */
  sha256Base64: (text: string) => Promise<string>;
}

/** Standard base64 to base64url without padding (RFC 4648, section 5). */
export function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The S256 challenge for a verifier. */
export async function pkceChallenge(verifier: string, sha256Base64: PkceCrypto['sha256Base64']): Promise<string> {
  return toBase64Url(await sha256Base64(verifier));
}

/**
 * A new pair. The verifier is 64 hexadecimal characters made from 256 random
 * bits. RFC 7636 asks for 43 to 128 unreserved characters, and hex is within that.
 */
export async function createPkcePair(crypto: PkceCrypto): Promise<PkcePair> {
  const verifier = Array.from(crypto.randomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  return { verifier, challenge: await pkceChallenge(verifier, crypto.sha256Base64) };
}
