import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SIGN_IN_LOOK,
  readSignInLook,
  writeSignInLook,
  type LoginTemplate,
  type SignInLook,
} from '../config/signInLook';
import { removeSignInImage } from '../utils/signInLookImage';

/**
 * The sign-in look for a department on this phone. Each change is kept straight
 * away. The setters resolve to false when the phone cannot save the change, and
 * the look on screen then stays as it was.
 */
export function useSignInLook(slug: string) {
  const [state, setState] = useState<{ slug: string; look: SignInLook } | null>(null);

  useEffect(() => {
    let cancelled = false;
    readSignInLook(slug).then((look) => {
      if (!cancelled) setState({ slug, look });
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

  const setTemplate = useCallback(
    (template: LoginTemplate) => save({ ...look, template }),
    [look, save],
  );

  /** Keeps a picture that was just copied to the phone. A picture that cannot be saved is removed again. */
  const setImage = useCallback(
    async (imageUri: string): Promise<boolean> => {
      const previous = look.imageUri;
      const saved = await save({ ...look, imageUri });
      if (saved) {
        if (previous && previous !== imageUri) removeSignInImage(previous);
      } else {
        removeSignInImage(imageUri);
      }
      return saved;
    },
    [look, save],
  );

  const removeImage = useCallback(async (): Promise<boolean> => {
    const previous = look.imageUri;
    const saved = await save({ template: look.template });
    if (saved && previous) removeSignInImage(previous);
    return saved;
  }, [look, save]);

  return { look, setTemplate, setImage, removeImage };
}
