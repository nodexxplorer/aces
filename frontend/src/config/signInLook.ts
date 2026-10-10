// The sign-in and sign-up look, chosen on each person's own device. The template
// and any image are kept in this browser, per department, so anyone can change
// them from the sign-in screen without a server change. Nothing here is sent to
// the server.

export type LoginTemplate = 'classic' | 'split' | 'centered';

export interface SignInLook {
  template: LoginTemplate;
  /** The image as a data URL, scaled down before it is kept. Absent when none is chosen. */
  imageDataUrl?: string;
}

/** The three templates, with a short line on each for the picker. */
export const LOGIN_TEMPLATES: { id: LoginTemplate; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'Video background, with the department panel.' },
  { id: 'split', label: 'Split', description: 'Your image on the left, the form on the right.' },
  { id: 'centered', label: 'Centered', description: 'Your image behind a card in the middle.' },
];

/** Image types accepted from the device. */
export const LOOK_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** The largest file accepted before it is scaled down. */
export const LOOK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The longest side of a kept image, in pixels. Keeps the stored copy small. */
export const LOOK_IMAGE_MAX_SIDE = 1600;

const STORAGE_PREFIX = 'aces.signInLook.';

const keyFor = (slug?: string) => `${STORAGE_PREFIX}${slug || 'default'}`;

/** The look this device has for a department (classic with no image when nothing is kept). */
export function readSignInLook(slug?: string): SignInLook {
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return { template: 'classic' };
    const parsed = JSON.parse(raw) as Partial<SignInLook>;
    const template = LOGIN_TEMPLATES.some((t) => t.id === parsed.template)
      ? (parsed.template as LoginTemplate)
      : 'classic';
    const imageDataUrl =
      typeof parsed.imageDataUrl === 'string' && parsed.imageDataUrl.startsWith('data:image/')
        ? parsed.imageDataUrl
        : undefined;
    return { template, imageDataUrl };
  } catch {
    return { template: 'classic' };
  }
}

/** Keeps the look on this device. Returns false when the browser has no room for it. */
export function writeSignInLook(slug: string | undefined, look: SignInLook): boolean {
  try {
    window.localStorage.setItem(keyFor(slug), JSON.stringify(look));
    return true;
  } catch {
    return false;
  }
}

/**
 * The template a page actually draws. Split and centered show the image, so without
 * one they fall back to classic (the video look), which needs none.
 */
export function resolveLoginTemplate(template: LoginTemplate | undefined, hasImage: boolean): LoginTemplate {
  if (!template || template === 'classic') return 'classic';
  return hasImage ? template : 'classic';
}

/** Checks a chosen file before it is read. Returns a message to show, or undefined when it is fine. */
export function checkLookImageFile(file: { type: string; size: number }): string | undefined {
  if (!(LOOK_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'The image must be a PNG, JPEG or WebP file.';
  }
  if (file.size > LOOK_IMAGE_MAX_BYTES) {
    return 'The image must be 10 MB or smaller.';
  }
  return undefined;
}

/**
 * Reads a chosen image and scales it down (longest side at most LOOK_IMAGE_MAX_SIDE),
 * so the copy kept on the device stays small. Resolves to a JPEG data URL.
 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LOOK_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot read the image.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
