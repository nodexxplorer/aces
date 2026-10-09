import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

/**
 * A department's short address opens sign-in with that department chosen: /co, or
 * aceszone://co. Signed-in users go to the home screen instead. The static routes
 * (login, scan, bursar, the tabs and the rest) match first, so only other first
 * segments arrive here. The sign-in screen ignores a code that names no department.
 */
export default function DepartmentLink() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    } else {
      router.replace({ pathname: '/(auth)/login', params: { code } });
    }
  }, [code, isAuthenticated, router]);

  return null;
}
