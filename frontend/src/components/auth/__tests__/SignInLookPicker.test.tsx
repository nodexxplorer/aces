import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SignInLookPicker } from '../SignInLookPicker';
import type { SignInLookControls } from '../../../hooks/useSignInLook';
import type { SavedWallpaper, SignInLook } from '../../../config/signInLook';

const notifyError = vi.fn();
const notifySuccess = vi.fn();
const createWallpaperMock = vi.fn();

vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({ success: notifySuccess, error: notifyError }),
}));

vi.mock('../../../api/wallpapers', () => ({
  createWallpaper: (prompt: string) => createWallpaperMock(prompt),
}));

vi.mock('../../../config/signInLook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/signInLook')>();
  return {
    ...actual,
    // jsdom has no canvas; the scaling itself is covered by the browser build.
    imageFileToDataUrl: vi.fn(async () => 'data:image/jpeg;base64,SCALED'),
  };
});

const WALL: SavedWallpaper = { id: 'wp-a', dataUrl: 'data:image/jpeg;base64,AAA', source: 'upload', savedAt: 1 };
const WALL2: SavedWallpaper = { id: 'wp-b', dataUrl: 'data:image/jpeg;base64,BBB', source: 'created', savedAt: 2 };

function controls(overrides: { look?: Partial<SignInLook>; library?: SavedWallpaper[] } = {}) {
  const look: SignInLook = { template: 'classic', dim: 'medium', ...overrides.look };
  const library = overrides.library ?? [];
  const wallpaper = library.find((w) => w.id === look.wallpaperId);
  const c = {
    look,
    library,
    wallpaper,
    setTemplate: vi.fn(() => true),
    setDim: vi.fn(() => true),
    saveWallpaper: vi.fn(() => ({ id: 'wp-new', dataUrl: 'x', source: 'upload', savedAt: 3 }) as SavedWallpaper),
    selectWallpaper: vi.fn(() => true),
    deleteWallpaper: vi.fn(() => true),
  };
  return c as unknown as SignInLookControls & typeof c;
}

const renderPicker = (c = controls()) => {
  const utils = render(<SignInLookPicker controls={c} />);
  return { ...utils, c };
};

describe('SignInLookPicker', () => {
  beforeEach(() => {
    notifyError.mockClear();
    notifySuccess.mockClear();
    createWallpaperMock.mockReset();
  });

  it('offers the three templates, with classic selected by default', () => {
    renderPicker();
    expect(screen.getByRole('radio', { name: 'Classic' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Split' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Centered' })).toHaveAttribute('aria-checked', 'false');
  });

  it('says the choice is saved on this device', () => {
    renderPicker();
    expect(screen.getByText('Saved on this device')).toBeInTheDocument();
  });

  it('changes the template when another one is clicked, and not when the same one is', () => {
    const { c } = renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'Split' }));
    expect(c.setTemplate).toHaveBeenCalledWith('split');
    fireEvent.click(screen.getByRole('radio', { name: 'Classic' }));
    expect(c.setTemplate).toHaveBeenCalledTimes(1);
  });

  it('shows no wallpaper controls for classic', () => {
    renderPicker();
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('asks for a wallpaper when split has none', () => {
    renderPicker(controls({ look: { template: 'split' } }));
    expect(screen.getByText('This look uses a wallpaper. Upload or create one to see it.')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Wallpaper dimming' })).not.toBeInTheDocument();
  });

  it('lists saved wallpapers and uses the one tapped', () => {
    const { c } = renderPicker(
      controls({ look: { template: 'centered', wallpaperId: 'wp-a' }, library: [WALL, WALL2] }),
    );
    expect(screen.getByRole('button', { name: 'Use saved wallpaper 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Use saved wallpaper 2 (created)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use saved wallpaper 2 (created)' }));
    expect(c.selectWallpaper).toHaveBeenCalledWith('wp-b');
  });

  it('sets the dim level once a wallpaper is in use', () => {
    const { c } = renderPicker(
      controls({ look: { template: 'split', wallpaperId: 'wp-a', dim: 'medium' }, library: [WALL] }),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(c.setDim).toHaveBeenCalledWith('dark');
  });

  it('removes the wallpaper in use from the device', () => {
    const { c } = renderPicker(
      controls({ look: { template: 'split', wallpaperId: 'wp-a', dim: 'medium' }, library: [WALL] }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove this wallpaper from the device' }));
    expect(c.deleteWallpaper).toHaveBeenCalledWith('wp-a');
  });

  it('refuses a file of the wrong type and keeps nothing', async () => {
    const { c, container } = renderPicker(controls({ look: { template: 'split' } }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })] } });
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError).toHaveBeenCalledWith('Wallpaper not added', expect.stringMatching(/PNG, JPEG or WebP/));
    expect(c.saveWallpaper).not.toHaveBeenCalled();
  });

  it('keeps an uploaded picture on the device as the wallpaper', async () => {
    const { c, container } = renderPicker(controls({ look: { template: 'split' } }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'hall.png', { type: 'image/png' })] } });
    await waitFor(() => expect(c.saveWallpaper).toHaveBeenCalledWith('data:image/jpeg;base64,SCALED', 'upload'));
    expect(notifySuccess).toHaveBeenCalledWith('Wallpaper added', 'It is kept on this device.');
  });

  it('opens the create form and sends the trimmed description', async () => {
    createWallpaperMock.mockResolvedValue({ mimeType: 'image/png', data: btoa('png-bytes') });
    const { c } = renderPicker(controls({ look: { template: 'centered' } }));

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    const box = screen.getByPlaceholderText('e.g. a lecture hall at sunset');
    fireEvent.change(box, { target: { value: '  a lecture hall at sunset  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create wallpaper' }));

    await waitFor(() => expect(c.saveWallpaper).toHaveBeenCalledWith('data:image/jpeg;base64,SCALED', 'created'));
    expect(createWallpaperMock).toHaveBeenCalledWith('a lecture hall at sunset');
    expect(notifySuccess).toHaveBeenCalledWith('Wallpaper created', 'It is kept on this device.');
  });

  it('shows the server message when the wallpaper cannot be created', async () => {
    createWallpaperMock.mockRejectedValue({
      response: { data: { error: 'Keep the description to 300 characters or fewer.' } },
    });
    const { c } = renderPicker(controls({ look: { template: 'centered' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. a lecture hall at sunset'), { target: { value: 'a lake' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create wallpaper' }));

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith(
        'Could not create the wallpaper',
        'Keep the description to 300 characters or fewer.',
      ),
    );
    expect(c.saveWallpaper).not.toHaveBeenCalled();
  });

  it('does not send an empty description', () => {
    renderPicker(controls({ look: { template: 'centered' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('button', { name: 'Create wallpaper' })).toBeDisabled();
    expect(createWallpaperMock).not.toHaveBeenCalled();
  });
});
