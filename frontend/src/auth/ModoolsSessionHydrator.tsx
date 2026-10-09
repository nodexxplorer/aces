import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { takeModoolsPayload } from '../api/modools';

// Modools OAuth returns the session in the URL fragment of /login (see the
// backend's modoolsFinish). This component reads it once and clears it, so the
// OAuth return behaves like a normal login. The existing router guard then
// sends unfinished students to /onboarding.
export default function ModoolsSessionHydrator() {
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    const payload = takeModoolsPayload();
    if (payload?.user && payload?.tokens) {
      sessionStorage.setItem('just_logged_in', 'true');
      login(payload.user, payload.tokens);
    }
  }, [login]);

  return null;
}
