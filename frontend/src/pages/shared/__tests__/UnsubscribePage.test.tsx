import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UnsubscribePage from '../UnsubscribePage';

const mockUnsubscribeFromEmails = vi.fn();
vi.mock('../../../api/notifications', () => ({
  unsubscribeFromEmails: (...args: unknown[]) => mockUnsubscribeFromEmails(...args),
}));

describe('UnsubscribePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('automatically unsubscribes when a token is provided in the route', async () => {
    mockUnsubscribeFromEmails.mockResolvedValue({
      message: "You've been unsubscribed from email notifications.",
    });

    render(
      <MemoryRouter initialEntries={['/notifications/unsubscribe/valid-token-123']}>
        <Routes>
          <Route path="/notifications/unsubscribe/:token" element={<UnsubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Unsubscribing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockUnsubscribeFromEmails).toHaveBeenCalledWith('valid-token-123');
      expect(screen.getByText("You're Unsubscribed")).toBeInTheDocument();
    });
  });

  it('renders email input form when no token is present and allows manual unsubscription', async () => {
    render(
      <MemoryRouter initialEntries={['/unsubscribe']}>
        <Routes>
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Unsubscribe from Newsletter/i })).toBeInTheDocument();
    const input = screen.getByPlaceholderText('name@student.edu.ng');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'student@example.com' } });
    const submitBtn = screen.getByRole('button', { name: /Unsubscribe from Newsletter/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("You're Unsubscribed")).toBeInTheDocument();
      expect(screen.getByText(/student@example.com has been unsubscribed/i)).toBeInTheDocument();
    });
  });
});
