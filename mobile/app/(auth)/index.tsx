import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/**
 * There is no welcome screen: signed-out users go straight to sign-in. This route
 * stays so that `/` still has a screen for them. The home tab at `/` sits behind the
 * signed-in guard in the root layout.
 */
export default function AuthIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(auth)/login');
  }, [router]);

  return null;
}
