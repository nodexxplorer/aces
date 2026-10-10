import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginLookSettings } from '../LoginLookSettings';
import * as api from '../../../api/loginLook';

const notify = { success: vi.fn(), error: vi.fn() };
const lookState: { data: api.LoginLook | undefined } = { data: undefined };

vi.mock('../../../hooks/useNotification', () => ({
  useNotification: () => ({ success: notify.success, error: notify.error }),
}));

vi.mock('../../../hooks/useLoginLook', () => ({
  useMyLoginLook: () => ({ data: lookState.data, isLoading: false, isError: false }),
}));

vi.mock('../../../api/loginLook', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../api/loginLook')>();
  return {
    ...real,
    saveLoginTemplate: vi.fn(async (template: string) => ({ template })),
    uploadLoginImage: vi.fn(async () => ({ template: 'split', imageUrl: '/api/v1/tenants/co/login-image?v=2' })),
    removeLoginImage: vi.fn(async () => ({ template: 'split' })),
  };
});

function renderCard(canEdit: boolean) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoginLookSettings canEdit={canEdit} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  lookState.data = { template: 'classic' };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LoginLookSettings', () => {
  it('marks the current template as checked', () => {
    lookState.data = { template: 'centered' };
    renderCard(true);
    expect(screen.getByRole('radio', { name: /Centered/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /Classic/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('saves the template an admin picks', async () => {
    renderCard(true);
    fireEvent.click(screen.getByRole('radio', { name: /Split/ }));
    await waitFor(() => expect(api.saveLoginTemplate).toHaveBeenCalledWith('split'));
  });

  it('does not re-save the template already chosen', () => {
    renderCard(true);
    fireEvent.click(screen.getByRole('radio', { name: /Classic/ }));
    expect(api.saveLoginTemplate).not.toHaveBeenCalled();
  });

  it('is read-only for people who are not admins', () => {
    renderCard(false);
    expect(screen.getByText(/Only an admin can change the sign-in look/)).toBeTruthy();
    // The choices sit in a disabled fieldset, which is what stops a click from reaching them.
    expect(screen.getByRole('radio', { name: /Split/ }).closest('fieldset')?.disabled).toBe(true);
  });

  it('refuses an SVG before sending it, and says why', () => {
    const { container } = renderCard(true);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const svg = new File(['<svg onload="alert(1)"></svg>'], 'look.png', { type: 'image/svg+xml' });
    fireEvent.change(input, { target: { files: [svg] } });
    expect(api.uploadLoginImage).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Image not uploaded', expect.stringMatching(/PNG, JPEG or WebP/));
  });

  it('uploads a valid image', async () => {
    const { container } = renderCard(true);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const png = new File(['x'], 'look.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [png] } });
    await waitFor(() => expect(api.uploadLoginImage).toHaveBeenCalledWith(png));
  });

  it('offers remove only when an image exists', () => {
    lookState.data = { template: 'split' };
    const { unmount } = renderCard(true);
    expect(screen.queryByRole('button', { name: /Remove image/ })).toBeNull();
    unmount();

    lookState.data = { template: 'split', imageUrl: '/api/v1/tenants/co/login-image?v=1' };
    renderCard(true);
    expect(screen.getByRole('button', { name: /Remove image/ })).toBeTruthy();
  });
});
