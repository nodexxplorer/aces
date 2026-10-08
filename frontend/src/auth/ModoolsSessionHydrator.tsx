import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { takeModoolsPayload } from '../api/modools';

// Modools OAuth returns the session through a URL-fragment handoff (see
// backend modoolsComplete): the backend's /auth/modools/complete page stashes
// the login-shaped payload in localStorage and redirects into the SPA. This
// component runs before the router renders and consumes that stash exactly
// once, so the OAuth return behaves identically to a normal login POST —
// the existing router guard then sends unfinished students to /onboarding.
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
