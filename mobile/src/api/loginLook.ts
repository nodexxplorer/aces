import apiClient, { getMediaUrl } from './client';

/** The three sign-in and sign-up templates. The web app chooses one per department in Settings. */
export type LoginTemplate = 'classic' | 'split' | 'centered';

export interface LoginLook {
  template: LoginTemplate;
  /** API path of the department's hero image. Absent when none is uploaded. */
  imageUrl?: string;
}

/** A department's sign-in look. Public: the sign-in screens read it before anyone signs in. */
export const getLoginLook = async (slug: string): Promise<LoginLook> => {
  const { data } = await apiClient.get<LoginLook>(`/tenants/${encodeURIComponent(slug)}/login-look`);
  return data;
};

/**
 * The template a screen uses. Split and centered show the department's image, so
 * without one they fall back to classic, which needs none.
 */
export function resolveLoginTemplate(template: LoginTemplate | undefined, hasImage: boolean): LoginTemplate {
  if (!template || template === 'classic') return 'classic';
  return hasImage ? template : 'classic';
}
