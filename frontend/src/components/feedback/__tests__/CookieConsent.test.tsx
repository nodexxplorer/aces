import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import CookieConsent from '../CookieConsent';

const NOTICE = { name: 'Cookie notice' };

function renderNotice(dark = false) {
  return render(
    <MemoryRouter>
      <CookieConsent dark={dark} />
    </MemoryRouter>,
  );
}

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('appears after a short delay as a strip in the page flow, not a floating card', async () => {
    const { container } = renderNotice();
    const region = await screen.findByRole('region', NOTICE, { timeout: 4000 });
    expect(region.className).not.toMatch(/\bfixed\b/);
    expect(container.querySelector('.fixed')).toBeNull();
  });

  it('stays hidden when the visitor has already made a choice', async () => {
    localStorage.setItem('aces_cookie_consent', 'declined');
    renderNotice();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(screen.queryByRole('region', NOTICE)).toBeNull();
  });

  it('accepting stores the choice and hides the notice', async () => {
    renderNotice();
    fireEvent.click(await screen.findByRole('button', { name: /Accept Cookies/ }, { timeout: 4000 }));
    expect(localStorage.getItem('aces_cookie_consent')).toBe('accepted');
    await waitFor(() => expect(screen.queryByRole('region', NOTICE)).toBeNull());
  });

  it('declining stores the choice and hides the notice', async () => {
    renderNotice();
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }, { timeout: 4000 }));
    expect(localStorage.getItem('aces_cookie_consent')).toBe('declined');
    await waitFor(() => expect(screen.queryByRole('region', NOTICE)).toBeNull());
  });

  it('the close button hides the notice for this visit only, without storing a choice', async () => {
    renderNotice();
    fireEvent.click(await screen.findByRole('button', { name: 'Hide the cookie notice' }, { timeout: 4000 }));
    expect(localStorage.getItem('aces_cookie_consent')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('region', NOTICE)).toBeNull());
  });

  it('uses the dark strip on the sign-in pages', async () => {
    renderNotice(true);
    const region = await screen.findByRole('region', NOTICE, { timeout: 4000 });
    expect(region.className).toContain('bg-surface-950/90');
  });
});
