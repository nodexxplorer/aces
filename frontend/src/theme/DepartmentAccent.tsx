import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { applyDepartmentAccent } from './accent';

/**
 * Applies the signed-in user's department accent for as long as they are signed
 * in. It renders nothing. Signed out, the sign-in pages apply the accent of the
 * department being chosen (see useDepartments).
 */
export default function DepartmentAccent() {
  const user = useAuthStore((state) => state.user);
  const accent = user?.tenant?.accentColor;
  useEffect(() => {
    if (user) applyDepartmentAccent(accent);
  }, [user, accent]);
  return null;
}
