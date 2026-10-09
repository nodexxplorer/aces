import { useCallback, useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { exchangeModoolsCode, modoolsConfigured, modoolsStartUrl } from '../api/modools';
import { useAuthStore } from '../store/authStore';
import { storeDepartment } from '../store/departmentStore';
import { getErrorMessage } from '../utils/errors';
import { parseModoolsReturn } from '../utils/modoolsReturn';
import { createPkcePair, type PkceCrypto } from '../utils/pkce';

/** Where the app takes the sign-in back. Its scheme must match the backend's mobileModoolsReturn. */
export const MODOOLS_RETURN_URL = 'aceszone://modools-complete';

const DEFAULT_MESSAGE = 'Modools sign-in did not complete. Try again.';
const STAFF_MESSAGE = 'Staff sign in on the website. This app is for students and class representatives.';
const MESSAGES: Record<string, string> = {
  staff_email: STAFF_MESSAGE,
  staff_account: STAFF_MESSAGE,
  account_deactivated: 'This account is deactivated. Contact your department.',
  unknown_department: 'That department is not available. Choose another one.',
  invalid_code: 'That sign-in has expired. Start it again.',
};

const pkceCrypto: PkceCrypto = {
  randomBytes: (n) => Crypto.getRandomBytes(n),
  sha256Base64: (text) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
};

/** The `error` code the server sent with a failed request, or null when it sent none. */
function serverErrorCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: unknown } } }).response?.data;
    if (typeof data?.error === 'string') return data.error;
  }
  return null;
}

/**
 * Signs a student in through Modools, in the browser, like the website does.
 * The app keeps a PKCE verifier for the sign-in and trades the one-time code it
 * gets back for the session. `configured` is null until the server has answered;
 * false means Modools is not set up there, so sign-in is unavailable.
 */
export function useModoolsSignIn() {
  const login = useAuthStore((s) => s.login);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    modoolsConfigured()
      .then((value) => {
        if (active) setConfigured(value);
      })
      .catch(() => {
        if (active) setConfigured(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (departmentSlug: string) => {
      setError(null);
      setBusy(true);
      try {
        // The verifier stays in this app. Only its challenge goes to the server.
        const pkce = await createPkcePair(pkceCrypto);
        const result = await WebBrowser.openAuthSessionAsync(
          modoolsStartUrl(departmentSlug, pkce.challenge),
          MODOOLS_RETURN_URL,
        );
        // Cancelling or closing the browser is not an error to show.
        if (result.type !== 'success') return;
        const outcome = parseModoolsReturn(result.url);
        if (outcome.kind !== 'code') {
          setError(MESSAGES[outcome.kind === 'error' ? outcome.code : ''] ?? DEFAULT_MESSAGE);
          return;
        }
        const session = await exchangeModoolsCode({
          code: outcome.code,
          verifier: pkce.verifier,
          tenant: departmentSlug,
        });
        await storeDepartment(departmentSlug);
        await login(session.user, session.tokens);
      } catch (err) {
        const code = serverErrorCode(err);
        setError(code !== null ? (MESSAGES[code] ?? DEFAULT_MESSAGE) : getErrorMessage(err, DEFAULT_MESSAGE));
      } finally {
        setBusy(false);
      }
    },
    [login],
  );

  return { configured, busy, error, signIn };
}
