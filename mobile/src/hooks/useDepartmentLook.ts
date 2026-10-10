import { useEffect, useState } from 'react';
import { getLoginLook, resolveLoginTemplate, type LoginLook, type LoginTemplate } from '../api/loginLook';
import { getMediaUrl } from '../api/client';

/**
 * The sign-in look for a department: the template to draw and the image address
 * (when the template uses one). A look that cannot be loaded is not an error for
 * sign-in, so the screen falls back to classic.
 */
export function useDepartmentLook(slug: string): { template: LoginTemplate; imageUri?: string } {
  const [look, setLook] = useState<LoginLook | undefined>(undefined);

  useEffect(() => {
    if (!slug) {
      setLook(undefined);
      return;
    }
    let cancelled = false;
    getLoginLook(slug)
      .then((next) => {
        if (!cancelled) setLook(next);
      })
      .catch(() => {
        if (!cancelled) setLook(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const imageUri = look?.imageUrl ? (getMediaUrl(look.imageUrl) ?? undefined) : undefined;
  return { template: resolveLoginTemplate(look?.template, Boolean(imageUri)), imageUri };
}
