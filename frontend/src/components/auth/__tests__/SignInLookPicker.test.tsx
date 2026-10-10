import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignInLookPicker } from '../SignInLookPicker';

const notifyError = vi.fn();
const notifySuccess = vi.fn();

vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({
    success: notifySuccess,
    error: notifyError,
  }),
}));

const renderPicker = (overrides: Partial<Parameters<typeof SignInLookPicker>[0]> = {}) => {
  const props = {
    look: { template: 'classic' as const },
    onTemplate: vi.fn(() => true),
    onImage: vi.fn(() => true),
    onRemoveImage: vi.fn(() => true),
    ...overrides,
  };
  const utils = render(<SignInLookPicker {...props} />);
  return { ...utils, props };
};

describe('SignInLookPicker', () => {
  beforeEach(() => {
    notifyError.mockClear();
    notifySuccess.mockClear();
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

  it('changes the template when another one is clicked', () => {
    const { props } = renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'Split' }));
    expect(props.onTemplate).toHaveBeenCalledWith('split');
  });

  it('does nothing when the selected template is clicked again', () => {
    const { props } = renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: 'Classic' }));
    expect(props.onTemplate).not.toHaveBeenCalled();
  });

  it('warns when split or centered is chosen without an image', () => {
    renderPicker({ look: { template: 'split' } });
    expect(screen.getByText('This look uses an image. Add one to see it.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
  });

  it('does not show the warning for classic', () => {
    renderPicker();
    expect(screen.queryByText('This look uses an image. Add one to see it.')).not.toBeInTheDocument();
  });

  it('shows Replace image and Remove image when an image is kept', () => {
    const { props } = renderPicker({ look: { template: 'split', imageDataUrl: 'data:image/jpeg;base64,AA' } });
    expect(screen.getByText('Replace image')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(props.onRemoveImage).toHaveBeenCalledTimes(1);
  });

  it('tells the person when the removal cannot be saved', () => {
    renderPicker({
      look: { template: 'split', imageDataUrl: 'data:image/jpeg;base64,AA' },
      onRemoveImage: vi.fn(() => false),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(notifyError).toHaveBeenCalledWith('Could not remove the image', 'Please try again.');
  });

  it('refuses a file of the wrong type and does not keep it', async () => {
    const { props, container } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError).toHaveBeenCalledWith('Image not added', expect.stringMatching(/PNG, JPEG or WebP/));
    expect(props.onImage).not.toHaveBeenCalled();
  });

  it('refuses a file over 10 MB', async () => {
    const { props, container } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError).toHaveBeenCalledWith('Image not added', expect.stringMatching(/10 MB/));
    expect(props.onImage).not.toHaveBeenCalled();
  });

  it('only accepts PNG, JPEG and WebP in the file input', () => {
    const { container } = renderPicker();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept.split(',').sort()).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});
