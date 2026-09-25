import apiClient, { unwrap } from './client';

// ─── Graduation path (500L) ──────────────────────────────────────────────
// Final-year students don't pay the regular dues cycle; they pay a one-off
// course-form-signing fee (admin-editable) whose payment unlocks CRF
// signing. Mirrors the CRF backlog flow.

export interface GraduationFee {
  amount: number;
  updated_by: string | null;
  updated_at: string;
}

export interface GraduationRequest {
  id: string;
  user_id: string;
  amount_charged: number;
  payment_id: string | null;
  status: 'pending_payment' | 'paid' | 'cleared';
  waived: boolean;
  created_by: string;
  created_at: string;
  paid_at: string | null;
  cleared_by: string | null;
  cleared_at: string | null;
}

export interface GraduationRequestRow extends GraduationRequest {
  full_name: string;
  matric_number: string;
  level: number;
  email: string;
}

// ─── Student ────────────────────────────────────────────────────────────────

export const getGraduationFee = async () => {
  const res = await apiClient.get('/graduation/fee');
  return unwrap<GraduationFee>(res);
};

export const getMyGraduationStatus = async (): Promise<GraduationRequest | null> => {
  const res = await apiClient.get('/graduation/mine');
  const body = res.data?.data ?? res.data;
  return (body ?? null) as GraduationRequest | null;
};

// Creates (or resumes) the student's graduation request. Returns the request
// plus the linked payment when newly created, or the existing request when
// resuming a dropped checkout.
export const createGraduationRequest = async () => {
  const res = await apiClient.post('/graduation/request');
  return unwrap<{
    graduation_request: GraduationRequest;
    payment?: { id: string };
    resumed?: boolean;
  }>(res);
};

// ─── Admin ──────────────────────────────────────────────────────────────────

export const updateGraduationFee = async (amount: number) => {
  const res = await apiClient.put('/graduation/fee', { amount });
  return unwrap<GraduationFee>(res);
};

export const listGraduationRequests = async () => {
  const res = await apiClient.get('/graduation/requests');
  return (unwrap<GraduationRequestRow[]>(res) ?? []) as GraduationRequestRow[];
};

export const createWaivedGraduationRequest = async (matricNumber: string) => {
  const res = await apiClient.post('/graduation/requests', { matric_number: matricNumber });
  return unwrap<GraduationRequestRow>(res);
};

export const clearGraduationRequest = async (id: string) => {
  const res = await apiClient.post(`/graduation/requests/${id}/clear`);
  return unwrap<GraduationRequest>(res);
};
