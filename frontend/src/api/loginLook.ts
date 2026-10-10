import apiClient from './client';

/** The three sign-in and sign-up templates a department can choose. */
export type LoginTemplate = 'classic' | 'split' | 'centered';

export interface LoginLook {
  template: LoginTemplate;
  /** API path of the hero image, versioned. Absent when no image is uploaded. */
  imageUrl?: string;
}

export const LOGIN_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
/** Largest hero image accepted. Matches the server and the database. */
export const LOGIN_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** The Settings page's template choices, with what each one looks like. */
export const LOGIN_TEMPLATES: { id: LoginTemplate; label: string; description: string }[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'The video background with the department panel on the left. The image is not shown.',
  },
  {
    id: 'split',
    label: 'Split',
    description: 'Your image fills the left half, with the form on the right.',
  },
  {
    id: 'centered',
    label: 'Centered',
    description: 'Your image is the backdrop, with the form in a card in the middle.',
  },
];

// Public: the sign-in pages read a department's look before anyone signs in.
export const getDepartmentLoginLook = async (slug: string): Promise<LoginLook> => {
  const { data } = await apiClient.get<LoginLook>(`/tenants/${encodeURIComponent(slug)}/login-look`);
  return data;
};

// Any signed-in user reads its own department's look (the Settings page).
export const getMyLoginLook = async (): Promise<LoginLook> => {
  const { data } = await apiClient.get<LoginLook>('/department/login-look');
  return data;
};

// Admins only. Switching the template keeps the image.
export const saveLoginTemplate = async (template: LoginTemplate): Promise<LoginLook> => {
  const { data } = await apiClient.put<LoginLook>('/department/login-look', { template });
  return data;
};

// Admins only. The image is sent as a multipart field named "file".
export const uploadLoginImage = async (file: File): Promise<LoginLook> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.put<LoginLook>('/department/login-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// Admins only. The template is kept; a template that needs an image falls back to classic.
export const removeLoginImage = async (): Promise<LoginLook> => {
  const { data } = await apiClient.delete<LoginLook>('/department/login-image');
  return data;
};

/** The image's full address: the API path joined to the API's base address. */
export function loginImageSrc(look?: LoginLook): string | undefined {
  if (!look?.imageUrl) return undefined;
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return `${base}${look.imageUrl}`;
}

/**
 * The template a page actually uses. Split and centered show the department's
 * image, so without one they fall back to classic (the video look), which needs
 * no image.
 */
export function resolveLoginTemplate(template: LoginTemplate | undefined, hasImage: boolean): LoginTemplate {
  if (!template || template === 'classic') return 'classic';
  return hasImage ? template : 'classic';
}

/** Client-side check of a chosen file, before it is sent. Returns an error message, or undefined when it is fine. */
export function checkLoginImageFile(file: { type: string; size: number }): string | undefined {
  if (!(LOGIN_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'The image must be a PNG, JPEG or WebP file.';
  }
  if (file.size > LOGIN_IMAGE_MAX_BYTES) {
    return 'The image must be 4 MB or smaller.';
  }
  return undefined;
}
