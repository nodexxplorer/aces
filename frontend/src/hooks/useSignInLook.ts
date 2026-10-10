import { useCallback, useState } from 'react';
import { readSignInLook, writeSignInLook, type LoginTemplate, type SignInLook } from '../config/signInLook';

/**
 * The sign-in look for a department on this device. Each change is kept
 * straight away. The setters return false when the browser has no room for the
 * change, and the look on screen then stays as it was.
 */
export function useSignInLook(slug?: string) {
  const [state, setState] = useState<{ slug?: string; look: SignInLook }>(() => ({
    slug,
    look: readSignInLook(slug),
  }));
  // A different department has its own look: read it when the slug changes.
  const look = state.slug === slug ? state.look : readSignInLook(slug);

  const update = useCallback(
    (next: SignInLook): boolean => {
      const saved = writeSignInLook(slug, next);
      if (saved) setState({ slug, look: next });
      return saved;
    },
    [slug],
  );

  const setTemplate = useCallback((template: LoginTemplate) => update({ ...look, template }), [look, update]);
  const setImage = useCallback((imageDataUrl: string) => update({ ...look, imageDataUrl }), [look, update]);
  const removeImage = useCallback(() => update({ template: look.template }), [look.template, update]);

  return { look, setTemplate, setImage, removeImage };
}
