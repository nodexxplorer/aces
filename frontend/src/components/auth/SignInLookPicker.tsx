import { useId, useState, type FormEvent } from 'react';
import {
  checkLookImageFile,
  DIM_LEVELS,
  fileFromBase64,
  imageFileToDataUrl,
  LOGIN_TEMPLATES,
  LOOK_IMAGE_TYPES,
  MAX_SAVED_WALLPAPERS,
  type DimLevel,
  type LoginTemplate,
} from '../../config/signInLook';
import { createWallpaper } from '../../api/wallpapers';
import { useNotification } from '../../hooks/useNotification';
import type { SignInLookControls } from '../../hooks/useSignInLook';

const MAX_PROMPT = 300;

/** The server's message when it has one, otherwise a general line. */
function serverMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : 'Try again in a moment.';
}

const PILL =
  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
const pill = (selected: boolean) =>
  `${PILL} ${selected ? 'bg-white text-surface-900' : 'bg-white/10 text-white hover:bg-white/20'}`;

/**
 * The look controls on the sign-in and sign-up pages. Anyone can use them. The
 * choices stay on this device: the template, the wallpaper (uploaded from the
 * device or created from a description) and how dim it is. Kept compact: the
 * wallpaper row holds the actions and the saved thumbnails together.
 */
export function SignInLookPicker({ controls }: { controls: SignInLookControls }) {
  const { look, library, wallpaper, setTemplate, setDim, saveWallpaper, selectWallpaper, deleteWallpaper } = controls;
  const { success, error: notifyError } = useNotification();
  const uploadId = useId();
  const promptId = useId();
  const [busy, setBusy] = useState<'upload' | 'create' | null>(null);
  const [creating, setCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const needsWallpaper = look.template !== 'classic';

  const pickTemplate = (template: LoginTemplate) => {
    if (template === look.template) return;
    if (!setTemplate(template)) {
      notifyError(
        'Could not save the look',
        'This browser has no room to keep it. Clear some site data and try again.',
      );
    }
  };

  const pickDim = (dim: DimLevel) => {
    if (dim === look.dim) return;
    if (!setDim(dim)) notifyError('Could not save the look', 'This browser has no room to keep it.');
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkLookImageFile(file);
    if (problem) {
      notifyError('Wallpaper not added', problem);
      return;
    }
    setBusy('upload');
    try {
      const dataUrl = await imageFileToDataUrl(file);
      if (saveWallpaper(dataUrl, 'upload')) {
        success('Wallpaper added', 'It is kept on this device.');
      } else {
        notifyError(
          'Wallpaper not added',
          'This browser has no room for it. Remove a saved one or try a smaller image.',
        );
      }
    } catch {
      notifyError('Wallpaper not added', 'This browser could not read that image. Try a PNG or JPEG.');
    } finally {
      setBusy(null);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    setBusy('create');
    try {
      const created = await createWallpaper(text);
      const dataUrl = await imageFileToDataUrl(fileFromBase64(created.mimeType, created.data));
      if (saveWallpaper(dataUrl, 'created')) {
        success('Wallpaper created', 'It is kept on this device.');
        setPrompt('');
        setCreating(false);
      } else {
        notifyError('Wallpaper not kept', 'This browser has no room for it. Remove a saved one and try again.');
      }
    } catch (err) {
      notifyError('Could not create the wallpaper', serverMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const onDelete = (id: string) => {
    if (!deleteWallpaper(id)) notifyError('Could not remove the wallpaper', 'Please try again.');
  };

  return (
    <div
      role="group"
      aria-label="Sign-in look"
      className="mb-3 rounded-xl border border-white/15 bg-black/30 p-2.5 text-white backdrop-blur"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Look</span>
        <span className="text-[11px] text-white/55">Saved on this device</span>
      </div>

      <div role="radiogroup" aria-label="Sign-in template" className="grid grid-cols-3 gap-1.5">
        {LOGIN_TEMPLATES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={look.template === option.id}
            title={option.description}
            onClick={() => pickTemplate(option.id)}
            className={`${pill(look.template === option.id)} py-1.5 text-xs`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {needsWallpaper && (
        <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-[11px] text-white/75">Wallpaper</span>
            <label
              htmlFor={uploadId}
              className={`cursor-pointer ${pill(false)} focus-within:ring-2 focus-within:ring-white ${
                busy ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              {busy === 'upload' ? 'Adding…' : 'Upload'}
            </label>
            <input
              id={uploadId}
              type="file"
              accept={LOOK_IMAGE_TYPES.join(',')}
              className="sr-only"
              disabled={busy !== null}
              onChange={(e) => {
                void onUpload(e.target.files?.[0]);
                // Let the same file be chosen again after a fix.
                e.target.value = '';
              }}
            />
            <button
              type="button"
              aria-expanded={creating}
              onClick={() => setCreating((v) => !v)}
              disabled={busy !== null}
              className={`${pill(creating)} disabled:opacity-60`}
            >
              Create
            </button>

            {library.length > 0 && (
              <div role="group" aria-label="Saved wallpapers" className="flex items-center gap-1 pl-1">
                {library.map((w, index) => {
                  const selected = look.wallpaperId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`Use saved wallpaper ${index + 1}${w.source === 'created' ? ' (created)' : ''}`}
                      title={w.source === 'created' ? 'Created' : 'Uploaded'}
                      onClick={() => {
                        if (!selectWallpaper(w.id)) notifyError('Could not save the look', 'Please try again.');
                      }}
                      className={`h-6 w-9 overflow-hidden rounded border ${
                        selected ? 'border-white ring-1 ring-white' : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img src={w.dataUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
                <span className="pl-0.5 text-[10px] text-white/50">
                  {library.length}/{MAX_SAVED_WALLPAPERS}
                </span>
              </div>
            )}
          </div>

          {creating && (
            <form onSubmit={onCreate} className="flex gap-1.5">
              <label htmlFor={promptId} className="sr-only">
                Describe the wallpaper
              </label>
              <input
                id={promptId}
                type="text"
                value={prompt}
                maxLength={MAX_PROMPT}
                disabled={busy !== null}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. a lecture hall at sunset"
                className="min-w-0 flex-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white placeholder:text-white/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              />
              <button
                type="submit"
                disabled={busy !== null || prompt.trim() === ''}
                className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-surface-900 disabled:opacity-60"
              >
                {busy === 'create' ? 'Creating…' : 'Create wallpaper'}
              </button>
            </form>
          )}

          {wallpaper ? (
            <div role="radiogroup" aria-label="Wallpaper dimming" className="flex items-center gap-1.5">
              {DIM_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  role="radio"
                  aria-checked={look.dim === level.id}
                  onClick={() => pickDim(level.id)}
                  className={`flex-1 ${pill(look.dim === level.id)}`}
                >
                  {level.label}
                </button>
              ))}
              <button
                type="button"
                aria-label="Remove this wallpaper from the device"
                title="Remove this wallpaper from the device"
                onClick={() => onDelete(wallpaper.id)}
                className="px-1.5 text-[11px] font-medium text-white/75 hover:text-white hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <span className="block text-[11px] text-white/65">
              This look uses a wallpaper. Upload or create one to see it.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default SignInLookPicker;
