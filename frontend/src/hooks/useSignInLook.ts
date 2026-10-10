import { useCallback, useState } from 'react';
import {
  addWallpaper,
  readSignInLook,
  readWallpapers,
  removeWallpaper,
  resolveWallpaper,
  writeSignInLook,
  type DimLevel,
  type LoginTemplate,
  type SavedWallpaper,
  type SignInLook,
} from '../config/signInLook';

/**
 * The sign-in look on this device: the department's template, wallpaper and dim
 * level, plus the device's saved wallpapers. Every change is kept straight away.
 * Setters return false (or null) when the browser has no room for the change, and
 * the look on screen then stays as it was.
 */
export function useSignInLook(slug?: string) {
  const [state, setState] = useState<{ slug?: string; look: SignInLook }>(() => ({
    slug,
    look: readSignInLook(slug),
  }));
  const [library, setLibrary] = useState<SavedWallpaper[]>(() => readWallpapers());

  // A different department has its own look: read it when the slug changes.
  const look = state.slug === slug ? state.look : readSignInLook(slug);

  const save = useCallback(
    (next: SignInLook): boolean => {
      const saved = writeSignInLook(slug, next);
      if (saved) setState({ slug, look: next });
      return saved;
    },
    [slug],
  );

  const setTemplate = useCallback((template: LoginTemplate) => save({ ...look, template }), [look, save]);

  const setDim = useCallback((dim: DimLevel) => save({ ...look, dim }), [look, save]);

  /**
   * Keeps a wallpaper on this device and uses it for this department. Returns the
   * saved wallpaper, or null when either save fails (and nothing changes).
   */
  const saveWallpaper = useCallback(
    (dataUrl: string, source: SavedWallpaper['source']): SavedWallpaper | null => {
      const wallpaper = addWallpaper(dataUrl, source);
      if (!wallpaper) return null;
      if (!save({ ...look, wallpaperId: wallpaper.id })) {
        removeWallpaper(wallpaper.id);
        return null;
      }
      setLibrary(readWallpapers());
      return wallpaper;
    },
    [look, save],
  );

  const selectWallpaper = useCallback((id: string) => save({ ...look, wallpaperId: id }), [look, save]);

  /**
   * Removes a saved wallpaper from this device. It is no longer used by any
   * department on this device.
   */
  const deleteWallpaper = useCallback(
    (id: string): boolean => {
      if (!removeWallpaper(id)) return false;
      setLibrary(readWallpapers());
      if (look.wallpaperId === id) save({ ...look, wallpaperId: undefined });
      return true;
    },
    [look, save],
  );

  const wallpaper = resolveWallpaper(look, library);

  return {
    look,
    library,
    wallpaper,
    setTemplate,
    setDim,
    saveWallpaper,
    selectWallpaper,
    deleteWallpaper,
  };
}

export type SignInLookControls = ReturnType<typeof useSignInLook>;
