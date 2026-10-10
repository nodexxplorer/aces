import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import Card, { CardDescription, CardHeader, CardTitle } from '../ui/Card';
import {
  LOGIN_IMAGE_TYPES,
  LOGIN_TEMPLATES,
  checkLoginImageFile,
  loginImageSrc,
  removeLoginImage,
  saveLoginTemplate,
  uploadLoginImage,
  type LoginLook,
  type LoginTemplate,
} from '../../api/loginLook';
import { useMyLoginLook } from '../../hooks/useLoginLook';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';

interface LoginLookSettingsProps {
  /** Only admins change the look. Everyone else sees the current choice. */
  canEdit: boolean;
}

/** A small drawing of each template, so the choice is visible before it is made. */
const TemplatePreview = ({ template }: { template: LoginTemplate }) => {
  if (template === 'split') {
    return (
      <div
        aria-hidden="true"
        className="flex h-16 w-full overflow-hidden rounded-md border border-surface-200 dark:border-surface-700"
      >
        <div className="w-1/2 bg-gradient-to-br from-primary-400 to-primary-700" />
        <div className="flex w-1/2 flex-col justify-center gap-1 bg-surface-100 p-2 dark:bg-surface-800">
          <div className="h-1.5 w-3/4 rounded bg-surface-400" />
          <div className="h-1.5 w-1/2 rounded bg-surface-300" />
        </div>
      </div>
    );
  }
  if (template === 'centered') {
    return (
      <div
        aria-hidden="true"
        className="flex h-16 w-full items-center justify-center rounded-md border border-surface-200 bg-gradient-to-br from-primary-400 to-primary-700 dark:border-surface-700"
      >
        <div className="flex w-2/5 flex-col gap-1 rounded bg-white/90 p-2 dark:bg-surface-800/90">
          <div className="h-1.5 w-3/4 rounded bg-surface-400" />
          <div className="h-1.5 w-1/2 rounded bg-surface-300" />
        </div>
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-16 w-full items-center justify-center rounded-md border border-surface-200 bg-surface-900 dark:border-surface-700"
    >
      <div className="flex w-2/5 flex-col gap-1 rounded bg-white/15 p-2">
        <div className="h-1.5 w-3/4 rounded bg-white/60" />
        <div className="h-1.5 w-1/2 rounded bg-white/40" />
      </div>
    </div>
  );
};

/**
 * The sign-in and sign-up look: which of the three templates the department's
 * pages use, and the hero image the split and centered templates show.
 */
export function LoginLookSettings({ canEdit }: LoginLookSettingsProps) {
  const { success, error: notifyError } = useNotification();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: look, isLoading, isError } = useMyLoginLook();

  // Every change refreshes this card and the public look the sign-in pages read.
  const applyLook = (next: LoginLook) => {
    queryClient.setQueryData(['login-look', 'mine'], next);
    queryClient.invalidateQueries({ queryKey: ['login-look'] });
  };

  const templateMutation = useMutation({
    mutationFn: (template: LoginTemplate) => saveLoginTemplate(template),
    onSuccess: (next) => {
      applyLook(next);
      success('Sign-in look saved', 'New sign-in and sign-up pages use this template.');
    },
    onError: (err) => notifyError('Could not save the look', getErrorMessage(err, 'Please try again.')),
  });

  const imageMutation = useMutation({
    mutationFn: (file: File) => uploadLoginImage(file),
    onSuccess: (next) => {
      applyLook(next);
      success('Image uploaded', 'The sign-in and sign-up pages show it when the template uses an image.');
    },
    onError: (err) => notifyError('Could not upload the image', getErrorMessage(err, 'Please try again.')),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeLoginImage(),
    onSuccess: (next) => {
      applyLook(next);
      success('Image removed', 'Templates that use an image fall back to classic.');
    },
    onError: (err) => notifyError('Could not remove the image', getErrorMessage(err, 'Please try again.')),
  });

  const busy = templateMutation.isPending || imageMutation.isPending || removeMutation.isPending;
  const current = look?.template ?? 'classic';
  const imageSrc = loginImageSrc(look);

  const onFilePicked = (file: File | undefined) => {
    if (!file) return;
    const problem = checkLoginImageFile(file);
    if (problem) {
      notifyError('Image not uploaded', problem);
    } else {
      imageMutation.mutate(file);
    }
    // Let the same file be picked again after a fix.
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sign-in and sign-up look</CardTitle>
          <CardDescription>
            Choose how the sign-in and sign-up pages look for your department, on the web and in the app. Split and
            centered show the image you upload here.
          </CardDescription>
        </div>
      </CardHeader>

      {isError && (
        <p role="alert" className="mb-4 text-sm text-danger-600 dark:text-danger-500">
          The current look could not be loaded. Refresh the page to try again.
        </p>
      )}

      {!canEdit && (
        <p
          role="note"
          className="mb-4 rounded-lg bg-surface-100 p-3 text-sm text-surface-700 dark:bg-surface-800 dark:text-surface-300"
        >
          Only an admin can change the sign-in look.
        </p>
      )}

      <fieldset disabled={!canEdit || busy || isLoading} className="space-y-6">
        <legend className="mb-3 text-sm font-medium text-surface-700 dark:text-surface-200">Template</legend>
        <div role="radiogroup" aria-label="Sign-in template" className="grid gap-3 sm:grid-cols-3">
          {LOGIN_TEMPLATES.map((option) => {
            const selected = current === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (!selected) templateMutation.mutate(option.id);
                }}
                className={`flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-950/30'
                    : 'border-surface-200 hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800'
                }`}
              >
                <TemplatePreview template={option.id} />
                <span>
                  <span className="block text-sm font-semibold text-surface-900 dark:text-surface-100">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs text-surface-600 dark:text-surface-400">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-surface-700 dark:text-surface-200">Hero image</p>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt="The current sign-in image"
              className="h-40 w-full max-w-md rounded-lg border border-surface-200 object-cover dark:border-surface-700"
            />
          ) : (
            <p className="text-sm text-surface-600 dark:text-surface-400">
              No image yet. Upload a picture of the page you want, up to 4 MB (PNG, JPEG or WebP).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              id="login-look-image"
              type="file"
              accept={LOGIN_IMAGE_TYPES.join(',')}
              className="sr-only"
              onChange={(e) => onFilePicked(e.target.files?.[0])}
            />
            <label
              htmlFor="login-look-image"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 focus-within:ring-2 focus-within:ring-primary-500 dark:border-surface-600 dark:text-surface-200 dark:hover:bg-surface-700"
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {imageSrc ? 'Replace image' : 'Upload image'}
            </label>
            {imageSrc && (
              <button
                type="button"
                onClick={() => removeMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-600 dark:text-danger-500 dark:hover:bg-surface-700"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove image
              </button>
            )}
          </div>
        </div>
      </fieldset>
    </Card>
  );
}

export default LoginLookSettings;
