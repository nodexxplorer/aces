import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from '../CommandPalette';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUser = {
  id: 'u-1',
  role: 'student',
  tenant: { urlCode: 'co' },
};

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../../../hooks/useRBAC', () => ({
  useRBAC: () => ({ activeRole: 'student' }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens on Ctrl+K and closes on Escape', () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );

    // Closed initially
    expect(screen.queryByPlaceholderText(/Search pages or type a command/i)).not.toBeInTheDocument();

    // Trigger Ctrl+K
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText(/Search pages or type a command/i)).toBeInTheDocument();

    // Trigger Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/Search pages or type a command/i)).not.toBeInTheDocument();
  });

  it('filters results when typing and navigates on Enter', () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByPlaceholderText(/Search pages or type a command/i);

    fireEvent.change(input, { target: { value: 'signing' } });
    expect(screen.getByText('Course Form Signing')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/i/course-form-signing');
  });

  it('opens Keyboard Shortcuts modal when pressing ?', () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Navigation')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + K / ⌘K')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Keyboard Navigation')).not.toBeInTheDocument();
  });
});
