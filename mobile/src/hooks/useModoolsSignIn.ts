import { useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { modoolsConfigured, modoolsStartUrl } from '../api/modools';
import { useAuthStore } from '../store/authStore';
import { storeDepartment } from '../store/departmentStore';
import { getErrorMessage } from '../utils/errors';
import { parseModoolsReturn } from '../utils/modoolsReturn';

/** Where the app takes the sign-in back. Its scheme must match the backend's mobileModoolsReturn. */
export const MODOOLS_RETURN_URL = 'aceszone://modools-complete';

const DEFAULT_MESSAGE = 'Modools sign-in did not complete. Try again.';
const MESSAGES: Record<string, string> = {
  staff_email: 'Staff sign in on the website. This app is for students and class representatives.',
  account_deactivated: 'This account is deactivated. Contact your department.',
  unknown_department: 'That department is not available. Choose another one.',
};

/**
 * Signs a student in through Modools, in the browser, like the website does.
 * `configured` is null until the server has answered; false means Modools is
 * not set up there, so sign-in is unavailable.
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
        const result = await WebBrowser.openAuthSessionAsync(modoolsStartUrl(departmentSlug), MODOOLS_RETURN_URL);
        // Cancelling or closing the browser is not an error to show.
        if (result.type !== 'success') return;
        const outcome = parseModoolsReturn(result.url);
        if (outcome.kind === 'session') {
          await storeDepartment(departmentSlug);
          await login(outcome.user, outcome.tokens);
          return;
        }
        setError(MESSAGES[outcome.kind === 'error' ? outcome.code : ''] ?? DEFAULT_MESSAGE);
      } catch (err) {
        setError(getErrorMessage(err, DEFAULT_MESSAGE));
      } finally {
        setBusy(false);
      }
    },
    [login],
  );

  return { configured, busy, error, signIn };
}
