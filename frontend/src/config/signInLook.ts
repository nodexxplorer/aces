// The sign-in and sign-up look, chosen on each person's own device. Nothing here
// is sent to the server, except the request to create a wallpaper (see
// api/wallpapers.ts), and the picture that comes back is kept here.
//
// There are no preset wallpapers. Split and centered show a wallpaper the person
// uploads or creates, and every wallpaper they keep is listed under "Saved".
// Classic keeps its built-in video.

export type LoginTemplate = 'classic' | 'split' | 'centered';

export type DimLevel = 'light' | 'medium' | 'dark';

/** Per-department choice: the template, which saved wallpaper, and how dim it is. */
export interface SignInLook {
  template: LoginTemplate;
  /** The id of a saved wallpaper. Absent when none is chosen for this department. */
  wallpaperId?: string;
  dim: DimLevel;
}

/** A wallpaper kept on this device, as a data URL scaled for the sign-in page. */
export interface SavedWallpaper {
  id: string;
  dataUrl: string;
  source: 'upload' | 'created';
  savedAt: number;
}

/** The three templates, with a short line on each for the picker. */
export const LOGIN_TEMPLATES: { id: LoginTemplate; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'Video background, with the department panel.' },
  { id: 'split', label: 'Split', description: 'The wallpaper on the left, the form on the right.' },
  { id: 'centered', label: 'Centered', description: 'The wallpaper behind a card in the middle.' },
];

/** How dark the wallpaper is made, so the form stays readable. */
export const DIM_LEVELS: { id: DimLevel; label: string; opacity: number }[] = [
  { id: 'light', label: 'Light', opacity: 0.3 },
  { id: 'medium', label: 'Medium', opacity: 0.55 },
  { id: 'dark', label: 'Dark', opacity: 0.75 },
];

export const DEFAULT_DIM: DimLevel = 'medium';

export const DEFAULT_SIGN_IN_LOOK: SignInLook = { template: 'classic', dim: DEFAULT_DIM };

/** Image types accepted from the device. */
export const LOOK_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** The largest file accepted from the device before it is scaled down. */
export const LOOK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The longest side of a kept wallpaper, in pixels. */
export const LOOK_IMAGE_MAX_SIDE = 1600;

/** How many wallpapers the device keeps. The oldest is dropped past this. */
export const MAX_SAVED_WALLPAPERS = 6;

const LOOK_PREFIX = 'aces.signInLook.';
const LIBRARY_KEY = 'aces.signInWallpapers';

const lookKey = (slug?: string) => `${LOOK_PREFIX}${slug || 'default'}`;

const isTemplate = (value: unknown): value is LoginTemplate => LOGIN_TEMPLATES.some((t) => t.id === value);

const isDim = (value: unknown): value is DimLevel => DIM_LEVELS.some((d) => d.id === value);

/** The look this device has for a department. */
export function readSignInLook(slug?: string): SignInLook {
  try {
    const raw = window.localStorage.getItem(lookKey(slug));
    if (!raw) return { ...DEFAULT_SIGN_IN_LOOK };
    const parsed = JSON.parse(raw) as Partial<SignInLook>;
    return {
      template: isTemplate(parsed.template) ? parsed.template : 'classic',
      wallpaperId: typeof parsed.wallpaperId === 'string' ? parsed.wallpaperId : undefined,
      dim: isDim(parsed.dim) ? parsed.dim : DEFAULT_DIM,
    };
  } catch {
    return { ...DEFAULT_SIGN_IN_LOOK };
  }
}

/** Keeps the look on this device. Returns false when the browser has no room for it. */
export function writeSignInLook(slug: string | undefined, look: SignInLook): boolean {
  try {
    window.localStorage.setItem(lookKey(slug), JSON.stringify(look));
    return true;
  } catch {
    return false;
  }
}

/** The wallpapers this device has saved, newest first. */
export function readWallpapers(): SavedWallpaper[] {
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is SavedWallpaper =>
        typeof w?.id === 'string' &&
        typeof w?.dataUrl === 'string' &&
        w.dataUrl.startsWith('data:image/') &&
        (w.source === 'upload' || w.source === 'created'),
    );
  } catch {
    return [];
  }
}

function writeWallpapers(list: SavedWallpaper[]): boolean {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a wallpaper on this device, as the newest. The oldest is dropped past
 * MAX_SAVED_WALLPAPERS. Returns the saved wallpaper, or null when the browser has
 * no room for it.
 */
export function addWallpaper(dataUrl: string, source: SavedWallpaper['source']): SavedWallpaper | null {
  const wallpaper: SavedWallpaper = {
    id: newWallpaperId(),
    dataUrl,
    source,
    savedAt: Date.now(),
  };
  const next = [wallpaper, ...readWallpapers()].slice(0, MAX_SAVED_WALLPAPERS);
  return writeWallpapers(next) ? wallpaper : null;
}

/** Removes a saved wallpaper from this device. */
export function removeWallpaper(id: string): boolean {
  return writeWallpapers(readWallpapers().filter((w) => w.id !== id));
}

function newWallpaperId(): string {
  return `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The saved wallpaper a department uses, if it still exists on this device. */
export function resolveWallpaper(look: SignInLook, library: SavedWallpaper[]): SavedWallpaper | undefined {
  if (!look.wallpaperId) return undefined;
  return library.find((w) => w.id === look.wallpaperId);
}

/** The template a page actually draws. Split and centered need a wallpaper, so without one they fall back to classic. */
export function resolveLoginTemplate(template: LoginTemplate | undefined, hasWallpaper: boolean): LoginTemplate {
  if (!template || template === 'classic') return 'classic';
  return hasWallpaper ? template : 'classic';
}

/** The overlay strength for a dim level, from 0 (none) to 1 (opaque). */
export function dimOpacity(dim: DimLevel): number {
  return DIM_LEVELS.find((d) => d.id === dim)?.opacity ?? 0.55;
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

/** Wraps a base64 picture from the server as a File, so it goes through the same scaling as an upload. */
export function fileFromBase64(mimeType: string, data: string): File {
  const binary = window.atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], 'wallpaper', { type: mimeType });
}

/**
 * Reads a chosen picture and scales it down (longest side at most LOOK_IMAGE_MAX_SIDE),
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
