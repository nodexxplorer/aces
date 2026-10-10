// The sign-in and sign-up look, chosen on each person's own phone. The template
// and any picture are kept on this device, per department, so anyone can change
// them on the sign-in screen. Nothing here is sent to the server. This mirrors
// frontend/src/config/signInLook.ts; keep the two in step.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';

export type LoginTemplate = 'classic' | 'split' | 'centered';

export interface SignInLook {
  template: LoginTemplate;
  /** The file address of the picture on this device. Absent when none is chosen. */
  imageUri?: string;
}

/** The three templates, with a short line on each for the picker. */
export const LOGIN_TEMPLATES: { id: LoginTemplate; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'Brand panel with the form on a sheet.' },
  { id: 'split', label: 'Split', description: 'Your picture across the top.' },
  { id: 'centered', label: 'Centered', description: 'Your picture behind a card.' },
];

/** Picture types accepted from the phone. */
export const LOOK_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** The largest file accepted before it is scaled down. */
export const LOOK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The longest side of a kept picture, in pixels. Matches the web app. */
export const LOOK_IMAGE_MAX_SIDE = 1600;

/** JPEG quality of a kept picture. Matches the web app. */
export const LOOK_IMAGE_QUALITY = 0.85;

const STORAGE_PREFIX = 'aces.signInLook.';

export const DEFAULT_SIGN_IN_LOOK: SignInLook = { template: 'classic' };

const keyFor = (slug: string) => `${STORAGE_PREFIX}${slug || 'default'}`;

/**
 * The template a screen actually draws. Split and centered show the picture, so
 * without one they fall back to classic, which needs none.
 */
export function resolveLoginTemplate(template: LoginTemplate | undefined, hasImage: boolean): LoginTemplate {
  if (!template || template === 'classic') return 'classic';
  return hasImage ? template : 'classic';
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

/**
 * The look this phone has for a department. A stored picture that is no longer
 * on the phone is dropped, so the screen falls back to classic.
 */
export async function readSignInLook(slug: string): Promise<SignInLook> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(slug));
    if (!raw) return DEFAULT_SIGN_IN_LOOK;
    const parsed = JSON.parse(raw) as Partial<SignInLook>;
    const template = LOGIN_TEMPLATES.some((t) => t.id === parsed.template)
      ? (parsed.template as LoginTemplate)
      : 'classic';
    let imageUri: string | undefined;
    if (typeof parsed.imageUri === 'string' && parsed.imageUri) {
      try {
        if (new File(parsed.imageUri).exists) imageUri = parsed.imageUri;
      } catch {
        imageUri = undefined;
      }
    }
    return { template, imageUri };
  } catch {
    return DEFAULT_SIGN_IN_LOOK;
  }
}

/** Keeps the look on this phone. Returns false when the save fails. */
export async function writeSignInLook(slug: string, look: SignInLook): Promise<boolean> {
  try {
    await AsyncStorage.setItem(keyFor(slug), JSON.stringify(look));
    return true;
  } catch {
    return false;
  }
}
