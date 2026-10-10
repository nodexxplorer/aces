// The sign-in and sign-up look, chosen on each person's own phone. Nothing here is
// sent to the server, except the request to create a wallpaper (see
// api/wallpapers.ts), and the picture that comes back is kept on the phone.
// This mirrors frontend/src/config/signInLook.ts; keep the two in step.
//
// There are no preset wallpapers. Split and centered show a wallpaper the person
// uploads or creates; every wallpaper they keep is listed under "Saved". Classic
// keeps its built-in brand panel.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';

export type LoginTemplate = 'classic' | 'split' | 'centered';

export type DimLevel = 'light' | 'medium' | 'dark';

/** Per-department choice: the template, which saved wallpaper, and how dim it is. */
export interface SignInLook {
  template: LoginTemplate;
  /** The id of a saved wallpaper. Absent when none is chosen for this department. */
  wallpaperId?: string;
  dim: DimLevel;
}

/** A wallpaper kept on this phone: a scaled JPEG in the app's own storage. */
export interface SavedWallpaper {
  id: string;
  /** The file address of the picture on this phone. */
  uri: string;
  source: 'upload' | 'created';
  savedAt: number;
}

/** The three templates, with a short line on each for the picker. */
export const LOGIN_TEMPLATES: { id: LoginTemplate; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'Brand panel with the form on a sheet.' },
  { id: 'split', label: 'Split', description: 'The wallpaper across the top.' },
  { id: 'centered', label: 'Centered', description: 'The wallpaper behind a card.' },
];

/** How dark the wallpaper is made, so the form stays readable. */
export const DIM_LEVELS: { id: DimLevel; label: string; opacity: number }[] = [
  { id: 'light', label: 'Light', opacity: 0.3 },
  { id: 'medium', label: 'Medium', opacity: 0.55 },
  { id: 'dark', label: 'Dark', opacity: 0.75 },
];

export const DEFAULT_DIM: DimLevel = 'medium';

export const DEFAULT_SIGN_IN_LOOK: SignInLook = { template: 'classic', dim: DEFAULT_DIM };

/** Picture types accepted from the phone. */
export const LOOK_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** The largest file accepted from the phone before it is scaled down. */
export const LOOK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The longest side of a kept wallpaper, in pixels. Matches the web app. */
export const LOOK_IMAGE_MAX_SIDE = 1600;

/** JPEG quality of a kept wallpaper. Matches the web app. */
export const LOOK_IMAGE_QUALITY = 0.85;

/** How many wallpapers the phone keeps. The oldest is dropped past this. */
export const MAX_SAVED_WALLPAPERS = 6;

const LOOK_PREFIX = 'aces.signInLook.';
const LIBRARY_KEY = 'aces.signInWallpapers';

const lookKey = (slug: string) => `${LOOK_PREFIX}${slug || 'default'}`;

const isTemplate = (value: unknown): value is LoginTemplate =>
  LOGIN_TEMPLATES.some((t) => t.id === value);

const isDim = (value: unknown): value is DimLevel => DIM_LEVELS.some((d) => d.id === value);

/** The template a screen actually draws. Split and centered need a wallpaper, so without one they fall back to classic. */
export function resolveLoginTemplate(template: LoginTemplate | undefined, hasWallpaper: boolean): LoginTemplate {
  if (!template || template === 'classic') return 'classic';
  return hasWallpaper ? template : 'classic';
}

/** The overlay strength for a dim level, from 0 (none) to 1 (opaque). */
export function dimOpacity(dim: DimLevel): number {
  return DIM_LEVELS.find((d) => d.id === dim)?.opacity ?? 0.55;
}

/** Checks a chosen picture before it is used. Returns a message to show, or undefined when it is fine. */
export function checkLookImage(asset: { mimeType?: string | null; fileSize?: number | null; uri: string }): string | undefined {
  const type = (asset.mimeType ?? typeFromName(asset.uri)).toLowerCase();
  if (!(LOOK_IMAGE_MIME_TYPES as readonly string[]).includes(type)) {
    return 'The image must be a PNG, JPEG or WebP file.';
  }
  if (typeof asset.fileSize === 'number' && asset.fileSize > LOOK_IMAGE_MAX_BYTES) {
    return 'The image must be 10 MB or smaller.';
  }
  return undefined;
}

function typeFromName(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return '';
}

/** The look this phone has for a department. */
export async function readSignInLook(slug: string): Promise<SignInLook> {
  try {
    const raw = await AsyncStorage.getItem(lookKey(slug));
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

/** Keeps the look on this phone. Returns false when the save fails. */
export async function writeSignInLook(slug: string, look: SignInLook): Promise<boolean> {
  try {
    await AsyncStorage.setItem(lookKey(slug), JSON.stringify(look));
    return true;
  } catch {
    return false;
  }
}

function isSavedWallpaper(value: unknown): value is SavedWallpaper {
  const w = value as Partial<SavedWallpaper> | null;
  return (
    typeof w?.id === 'string' &&
    typeof w?.uri === 'string' &&
    (w.source === 'upload' || w.source === 'created') &&
    typeof w.savedAt === 'number'
  );
}

/** The wallpapers this phone has saved, newest first. Entries whose file is gone are dropped. */
export async function readWallpapers(): Promise<SavedWallpaper[]> {
  try {
    const raw = await AsyncStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedWallpaper).filter((w) => {
      try {
        return new File(w.uri).exists;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

async function writeWallpapers(list: SavedWallpaper[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves a wallpaper on this phone, as the newest. The oldest is dropped past
 * MAX_SAVED_WALLPAPERS and its file removed. Returns the saved wallpaper, or null
 * when the phone cannot save it.
 */
export async function addWallpaper(uri: string, source: SavedWallpaper['source']): Promise<SavedWallpaper | null> {
  const wallpaper: SavedWallpaper = {
    id: newWallpaperId(),
    uri,
    source,
    savedAt: Date.now(),
  };
  const current = await readWallpapers();
  const next = [wallpaper, ...current];
  const kept = next.slice(0, MAX_SAVED_WALLPAPERS);
  if (!(await writeWallpapers(kept))) return null;
  for (const dropped of next.slice(MAX_SAVED_WALLPAPERS)) deleteFile(dropped.uri);
  return wallpaper;
}

/** Removes a saved wallpaper and its file from this phone. */
export async function removeWallpaper(id: string): Promise<boolean> {
  const current = await readWallpapers();
  const gone = current.find((w) => w.id === id);
  if (!(await writeWallpapers(current.filter((w) => w.id !== id)))) return false;
  if (gone) deleteFile(gone.uri);
  return true;
}

function deleteFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or not ours to delete.
  }
}

function newWallpaperId(): string {
  return `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The saved wallpaper a department uses, if it still exists on this phone. */
export function resolveWallpaper(look: SignInLook, library: SavedWallpaper[]): SavedWallpaper | undefined {
  if (!look.wallpaperId) return undefined;
  return library.find((w) => w.id === look.wallpaperId);
}
