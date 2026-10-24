import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CourseFormSigningPage from '../CourseFormSigningPage';
import * as crf from '../../../api/crf-signing';
import * as payments from '../../../api/payments';
import * as sessions from '../../../api/sessions';

vi.mock('../../../api/crf-signing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/crf-signing')>();
  return {
    ...actual,
    getMyCRFSubmission: vi.fn(),
    listCRFSignatureAssets: vi.fn(),
    getCRFBacklogPrice: vi.fn(),
    getMyCRFBacklogStatus: vi.fn(),
    listMyCRFDrafts: vi.fn(),
    listMyCRFHistory: vi.fn(),
  };
});
vi.mock('../../../api/payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/payments')>();
  return { ...actual, getMyDues: vi.fn(), checkDuePaid: vi.fn() };
});
vi.mock('../../../api/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/sessions')>();
  return { ...actual, getSessions: vi.fn(), listSessionSemesters: vi.fn() };
});
vi.mock('../../../components/crf/SignaturePlacementCanvas', () => ({ default: () => null }));
const mockUser = { firstName: 'Ada', level: 200 };
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

const signed = { id: 'sub-1', status: 'completed', semester_id: 'sem-1', placements: {} } as never;

describe('course form signing: sign new course', () => {
  beforeEach(() => {
    vi.mocked(crf.getMyCRFSubmission).mockResolvedValue(signed);
    vi.mocked(crf.listCRFSignatureAssets).mockResolvedValue([]);
    vi.mocked(crf.getCRFBacklogPrice).mockResolvedValue({ amount_per_backlog: 1000 } as never);
    vi.mocked(crf.getMyCRFBacklogStatus).mockResolvedValue(null);
    vi.mocked(crf.listMyCRFDrafts).mockResolvedValue([]);
    vi.mocked(crf.listMyCRFHistory).mockResolvedValue([signed]);
    vi.mocked(payments.getMyDues).mockResolvedValue([] as never);
    vi.mocked(sessions.getSessions).mockResolvedValue([]);
    vi.mocked(sessions.listSessionSemesters).mockResolvedValue([]);
  });

  it('offers Sign new course after a form is signed, and reveals the backlog card', async () => {
    render(
      <MemoryRouter>
        <CourseFormSigningPage />
      </MemoryRouter>,
    );

    const button = await screen.findByRole('button', { name: 'Sign new course' });
    expect(screen.queryByText('Sign an old course form')).not.toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText('Sign an old course form')).toBeInTheDocument());
  });
});
