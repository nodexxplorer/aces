import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RefundPolicyPage from '../RefundPolicyPage';

describe('RefundPolicyPage', () => {
  it('renders payment and refund policy sections', () => {
    render(
      <MemoryRouter>
        <RefundPolicyPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Payment & Refund Policy/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Departmental Dues/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Course Form Signing Fees/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /CRF Catch-Up & Backlog Slots/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Duplicate or Overpayment Exceptions/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Non-Refundable Scenarios/i })).toBeInTheDocument();
  });
});
