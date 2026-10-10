import { useId, useState } from 'react';
import {
  checkLookImageFile,
  imageFileToDataUrl,
  LOGIN_TEMPLATES,
  LOOK_IMAGE_TYPES,
  type LoginTemplate,
  type SignInLook,
} from '../../config/signInLook';
import { useNotification } from '../../hooks/useNotification';

interface SignInLookPickerProps {
  look: SignInLook;
  onTemplate: (template: LoginTemplate) => boolean;
  onImage: (dataUrl: string) => boolean;
  onRemoveImage: () => boolean;
}

/**
 * The template choice on the sign-in and sign-up pages. Anyone can change it;
 * the choice stays on this device. The picture is optional: split and centered
 * need one, and say so until one is added.
 */
export function SignInLookPicker({ look, onTemplate, onImage, onRemoveImage }: SignInLookPickerProps) {
  const { success, error: notifyError } = useNotification();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const needsImage = look.template !== 'classic';

  const pick = (template: LoginTemplate) => {
    if (template === look.template) return;
    if (!onTemplate(template)) {
      notifyError(
        'Could not save the look',
        'This browser has no room to keep it. Clear some site data and try again.',
      );
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = checkLookImageFile(file);
    if (problem) {
      notifyError('Image not added', problem);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await imageFileToDataUrl(file);
      if (onImage(dataUrl)) {
        success('Image added', 'It is kept on this device.');
      } else {
        notifyError('Image not added', 'This browser has no room for it. Try a smaller image.');
      }
    } catch {
      notifyError('Image not added', 'This browser could not read that image. Try a PNG or JPEG.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="group"
      aria-label="Sign-in look"
      className="mb-4 rounded-xl border border-white/15 bg-black/30 p-3 text-white backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/75">Look</span>
        <span className="text-[11px] text-white/55">Saved on this device</span>
      </div>

      <div role="radiogroup" aria-label="Sign-in template" className="grid grid-cols-3 gap-2">
        {LOGIN_TEMPLATES.map((option) => {
          const selected = look.template === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={option.description}
              onClick={() => pick(option.id)}
              className={`rounded-lg px-2 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                selected ? 'bg-white text-surface-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <label
          htmlFor={inputId}
          className={`cursor-pointer rounded-md bg-white/10 px-2.5 py-1.5 font-medium text-white hover:bg-white/20 focus-within:ring-2 focus-within:ring-white ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          {busy ? 'Adding…' : look.imageDataUrl ? 'Replace image' : 'Add image'}
        </label>
        <input
          id={inputId}
          type="file"
          accept={LOOK_IMAGE_TYPES.join(',')}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            // Let the same file be chosen again after a fix.
            e.target.value = '';
          }}
        />
        {look.imageDataUrl && (
          <button
            type="button"
            onClick={() => {
              if (!onRemoveImage()) notifyError('Could not remove the image', 'Please try again.');
            }}
            className="rounded-md px-2.5 py-1.5 font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            Remove image
          </button>
        )}
        {needsImage && !look.imageDataUrl && (
          <span className="text-white/65">This look uses an image. Add one to see it.</span>
        )}
      </div>
    </div>
  );
}

export default SignInLookPicker;
