import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { checkLookImage, LOOK_IMAGE_MAX_SIDE, LOOK_IMAGE_QUALITY } from '../config/signInLook';

const FOLDER = 'sign-in-look';

/**
 * Lets the person choose a picture from their phone, scales it down (longest
 * side at most 1600 px, saved as JPEG) and keeps the copy in the app's own
 * storage. Resolves to the copy's address, or null when they cancel.
 * Throws an Error whose message can be shown when the picture cannot be used.
 */
export async function pickSignInImage(slug: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const problem = checkLookImage(asset);
  if (problem) throw new Error(problem);

  const longest = Math.max(asset.width, asset.height);
  const needsResize = longest > LOOK_IMAGE_MAX_SIDE;
  const size = asset.width >= asset.height ? { width: LOOK_IMAGE_MAX_SIDE } : { height: LOOK_IMAGE_MAX_SIDE };

  let context = ImageManipulator.manipulate(asset.uri);
  if (needsResize) context = context.resize(size);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: LOOK_IMAGE_QUALITY });

  const dir = new Directory(Paths.document, FOLDER);
  dir.create({ intermediates: true, idempotent: true });
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '') || 'default';
  const dest = new File(dir, `${safeSlug}-${Date.now()}.jpg`);
  new File(saved.uri).copy(dest);
  return dest.uri;
}

/** Deletes a kept picture. Missing files are not an error. */
export function removeSignInImage(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or not ours to delete.
  }
}
