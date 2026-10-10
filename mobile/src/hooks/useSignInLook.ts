import { useCallback, useEffect, useState } from 'react';
import {
  addWallpaper,
  DEFAULT_SIGN_IN_LOOK,
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
 * The sign-in look on this phone: the department's template, wallpaper and dim
 * level, plus the phone's saved wallpapers. Every change is kept straight away.
 * Setters resolve to false (or null) when the phone cannot save the change, and
 * the look on screen then stays as it was.
 */
export function useSignInLook(slug: string) {
  const [state, setState] = useState<{ slug: string; look: SignInLook } | null>(null);
  const [library, setLibrary] = useState<SavedWallpaper[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([readSignInLook(slug), readWallpapers()]).then(([look, list]) => {
      if (cancelled) return;
      setState({ slug, look });
      setLibrary(list);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Until this department's look is read, the default is drawn.
  const look = state && state.slug === slug ? state.look : DEFAULT_SIGN_IN_LOOK;

  const save = useCallback(
    async (next: SignInLook): Promise<boolean> => {
      const saved = await writeSignInLook(slug, next);
      if (saved) setState({ slug, look: next });
      return saved;
    },
    [slug],
  );

  const refreshLibrary = useCallback(async () => {
    setLibrary(await readWallpapers());
  }, []);

  const setTemplate = useCallback((template: LoginTemplate) => save({ ...look, template }), [look, save]);

  const setDim = useCallback((dim: DimLevel) => save({ ...look, dim }), [look, save]);

  /**
   * Keeps a wallpaper on this phone and uses it for this department. Resolves to
   * the saved wallpaper, or null when either save fails (and nothing changes).
   */
  const saveWallpaper = useCallback(
    async (uri: string, source: SavedWallpaper['source']): Promise<SavedWallpaper | null> => {
      const wallpaper = await addWallpaper(uri, source);
      if (!wallpaper) return null;
      if (!(await save({ ...look, wallpaperId: wallpaper.id }))) {
        await removeWallpaper(wallpaper.id);
        return null;
      }
      await refreshLibrary();
      return wallpaper;
    },
    [look, save, refreshLibrary],
  );

  const selectWallpaper = useCallback((id: string) => save({ ...look, wallpaperId: id }), [look, save]);

  /** Removes a saved wallpaper from this phone. A department that used it goes back to classic. */
  const deleteWallpaper = useCallback(
    async (id: string): Promise<boolean> => {
      if (!(await removeWallpaper(id))) return false;
      await refreshLibrary();
      if (look.wallpaperId === id) await save({ ...look, wallpaperId: undefined });
      return true;
    },
    [look, save, refreshLibrary],
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
