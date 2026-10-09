import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DepartmentAddresses } from '../DepartmentAddresses';
import { STAFF_LOGIN_PATH } from '../../../config/department';

const ORIGIN = 'https://aces.example';
const CODED = { name: 'Department of Computer Engineering', urlCode: 'co' };

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DepartmentAddresses', () => {
  it('shows the student and staff addresses of a department with a code', () => {
    render(<DepartmentAddresses department={CODED} origin={ORIGIN} />);
    expect(screen.getByTestId('address-students').textContent).toBe('https://aces.example/co');
    expect(screen.getByTestId('address-staff').textContent).toBe('https://aces.example/co/admin');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('falls back to the general sign-in pages, with a note, when the department has no code', () => {
    render(<DepartmentAddresses department={{ name: 'Department without a code' }} origin={ORIGIN} />);
    expect(screen.getByTestId('address-students').textContent).toBe(`${ORIGIN}/login`);
    expect(screen.getByTestId('address-staff').textContent).toBe(`${ORIGIN}${STAFF_LOGIN_PATH}`);
    expect(screen.getByRole('note').textContent).toContain('no short address yet');
  });

  it('copies an address and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<DepartmentAddresses department={CODED} origin={ORIGIN} />);

    const button = screen.getByRole('button', { name: 'Copy the staff and admins address' });
    fireEvent.click(button);

    await waitFor(() => expect(button.textContent).toContain('Copied'));
    expect(writeText).toHaveBeenCalledWith('https://aces.example/co/admin');
  });

  it('keeps the address on screen when the clipboard refuses', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('permission denied'));
    setClipboard(writeText);
    render(<DepartmentAddresses department={CODED} origin={ORIGIN} />);

    const button = screen.getByRole('button', { name: 'Copy the students address' });
    fireEvent.click(button);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://aces.example/co'));
    expect(screen.getByTestId('address-students').textContent).toBe('https://aces.example/co');
    expect(button.textContent).toContain('Copy');
    expect(button.textContent).not.toContain('Copied');
  });
});
