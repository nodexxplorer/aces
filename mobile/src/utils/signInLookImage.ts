import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { checkLookImage, LOOK_IMAGE_MAX_SIDE, LOOK_IMAGE_QUALITY } from '../config/signInLook';

const FOLDER = 'sign-in-look';

function uniqueName(ext: string): string {
  return `wallpaper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/**
 * Lets the person choose a picture from their phone. Resolves to the picture's
 * address, or null when they cancel. Throws an Error whose message can be shown
 * when the picture cannot be used.
 */
export async function pickLookImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const problem = checkLookImage(asset);
  if (problem) throw new Error(problem);
  return asset.uri;
}

/**
 * Keeps a picture from the server: it is written to a temporary file, scaled and
 * saved the same way as a picked picture, and the temporary file is removed.
 */
export async function keepCreatedImage(mimeType: string, data: string): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const temp = new File(Paths.cache, uniqueName(ext));
  temp.write(data, { encoding: 'base64' });
  try {
    return await keepLookImage(temp.uri);
  } finally {
    if (temp.exists) temp.delete();
  }
}

/**
 * Scales a picture so its longest side is at most LOOK_IMAGE_MAX_SIDE, saves it as
 * JPEG in the app's own storage, and returns that copy's address.
 */
export async function keepLookImage(sourceUri: string): Promise<string> {
  const probe = await ImageManipulator.manipulate(sourceUri).renderAsync();
  let context = ImageManipulator.manipulate(sourceUri);
  if (Math.max(probe.width, probe.height) > LOOK_IMAGE_MAX_SIDE) {
    context = context.resize(
      probe.width >= probe.height ? { width: LOOK_IMAGE_MAX_SIDE } : { height: LOOK_IMAGE_MAX_SIDE },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: LOOK_IMAGE_QUALITY });

  const dir = new Directory(Paths.document, FOLDER);
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, uniqueName('jpg'));
  new File(saved.uri).copy(dest);
  return dest.uri;
}
