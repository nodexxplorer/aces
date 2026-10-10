import { useQuery } from '@tanstack/react-query';
import { getDepartmentLoginLook, getMyLoginLook } from '../api/loginLook';

/** A department's sign-in look, for the public sign-in and sign-up pages. Empty until the department is known. */
export function useDepartmentLoginLook(slug?: string) {
  return useQuery({
    queryKey: ['login-look', slug ?? ''],
    queryFn: () => getDepartmentLoginLook(slug as string),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  });
}

/** The signed-in user's own department's look, for the Settings page. */
export function useMyLoginLook(enabled = true) {
  return useQuery({
    queryKey: ['login-look', 'mine'],
    queryFn: getMyLoginLook,
    enabled,
  });
}
