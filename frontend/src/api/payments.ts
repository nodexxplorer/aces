import apiClient, { unwrap } from './client';
import type { Payment, DuePayment, Defaulter, PaginationParams } from '../types';

export const getStudentPayments = async (studentId: string, params?: PaginationParams) => {
  const res = await apiClient.get(`/payments/student/${studentId}`, { params: { limit: 100, offset: 0, ...params } });
  return unwrap<Payment[]>(res);
};

export const getAllPayments = async (params?: PaginationParams) => {
  const res = await apiClient.get('/payments', { params: { limit: 100, offset: 0, ...params } });
  return unwrap<Payment[]>(res);
};

export const getPayment = async (paymentId: string) => {
  const res = await apiClient.get(`/payments/${paymentId}`);
  return unwrap<Payment>(res);
};

export const getPaymentByReference = async (reference: string) => {
  const res = await apiClient.get('/payments/by-reference', { params: { reference } });
  return unwrap<Payment>(res);
};

export const getMyPaymentByReference = async (reference: string) => {
  const res = await apiClient.get('/payments/my-reference', { params: { reference } });
  return unwrap<Payment>(res);
};

// Actively re-verifies the reference against Paystack and completes the
// payment if it succeeded — call this on the post-checkout redirect instead
// of getMyPaymentByReference, since the webhook alone can't be relied on
// (unreachable on localhost, occasionally delayed/dropped in production).
export const confirmMyPaymentByReference = async (reference: string) => {
  const res = await apiClient.post('/payments/confirm', null, { params: { reference } });
  return unwrap<Payment>(res);
};

export const getStudentPaymentSummary = async (studentId: string) => {
  const res = await apiClient.get(`/payments/summary/${studentId}`);
  return unwrap<{ total_paid: number; total_pending: number; amount_paid: number; amount_pending: number }>(res);
};

export const getMyDues = async (level?: number) => {
  const res = await apiClient.get('/payments/dues/level', { params: { level } });
  return unwrap<DuePayment[]>(res);
};

export const getAllDues = async (params?: PaginationParams) => {
  const res = await apiClient.get('/payments/dues', { params: { limit: 100, offset: 0, ...params } });
  return unwrap<DuePayment[]>(res);
};

export const getDue = async (dueId: string) => {
  const res = await apiClient.get(`/payments/dues/${dueId}`);
  return unwrap<DuePayment>(res);
};

export const createDue = async (payload: {
  name: string;
  description?: string;
  type: string;
  amount: string;
  level?: number;
  session_id?: string;
  semester_id?: string;
  deadline?: string;
}) => {
  const res = await apiClient.post('/payments/dues', payload);
  return unwrap<DuePayment>(res);
};

export const updateDue = async (dueId: string, payload: Partial<DuePayment>) => {
  const res = await apiClient.put(`/payments/dues/${dueId}`, payload);
  return unwrap<DuePayment>(res);
};

export const deleteDue = async (dueId: string) => {
  await apiClient.delete(`/payments/dues/${dueId}`);
};

export const createPayment = async (payload: {
  student_id: string;
  due_id: string;
  type: string;
  item_name: string;
  amount: string;
}) => {
  const res = await apiClient.post('/payments', payload);
  return unwrap<Payment>(res);
};

export const verifyPayment = async (paymentId: string) => {
  const res = await apiClient.post(`/payments/${paymentId}/verify`);
  return unwrap<Payment>(res);
};

export const updatePaymentStatus = async (paymentId: string, status: string) => {
  const res = await apiClient.put(`/payments/${paymentId}/status`, { status });
  return unwrap<Payment>(res);
};

// _studentId is unused (the backend derives the student from the auth token)
// but kept in the signature for call-site compatibility.
export const checkDuePaid = async (dueId: string, _studentId?: string) => {
  void _studentId;
  const res = await apiClient.get('/payments/check-paid', { params: { due_id: dueId } });
  return unwrap<{ student_id: string; due_id: string; is_paid: boolean }>(res);
};

export const initializeCheckout = async (paymentId: string, email: string) => {
  const res = await apiClient.post('/payments/checkout', { payment_id: paymentId, email });
  return unwrap<{ authorization_url: string; reference: string; access_code: string }>(res);
};

export const getDefaulters = async () => {
  const res = await apiClient.get('/payments/defaulters');
  return unwrap<Defaulter[]>(res);
};

export const getRecentVerifiedPayments = async (params?: PaginationParams) => {
  const res = await apiClient.get('/payments/recent-verified', { params: { limit: 20, offset: 0, ...params } });
  return unwrap<Payment[]>(res);
};

// ─── Cart ───────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  student_id: string;
  due_id: string;
  amount: number;
  added_at: string;
}

export const addToCart = async (_studentId: string, dueId: string, amount: number) => {
  const res = await apiClient.post('/payments/cart', {
    due_id: dueId,
    amount: String(amount),
  });
  return unwrap<CartItem>(res);
};

// _studentId is unused (the backend resolves the current student from the
// auth token via the /me endpoint) but kept for call-site compatibility.
export const listStudentCart = async (_studentId: string) => {
  void _studentId;
  const res = await apiClient.get(`/payments/cart/me`);
  return unwrap<CartItem[]>(res);
};

export const removeFromCart = async (cartItemId: string) => {
  await apiClient.delete(`/payments/cart/${cartItemId}`);
};

// _studentId is unused (the backend resolves the current student from the
// auth token via the /me endpoint) but kept for call-site compatibility.
export const clearStudentCart = async (_studentId: string) => {
  void _studentId;
  await apiClient.delete(`/payments/cart/me`);
};

export const checkoutCart = async () => {
  const res = await apiClient.post('/payments/checkout-cart');
  return unwrap<{ authorization_url: string; reference: string; access_code: string; batch_id: string }>(res);
};

// ─── Dues Receipts ──────────────────────────────────────────────────────────

// Downloads the official receipt PDF for a completed department/class dues
// payment. The backend streams application/pdf with a Content-Disposition
// filename, so this is a blob request — not a normal JSON call — and must
// carry the session cookie like every other authenticated request.
export const downloadPaymentReceipt = async (paymentId: string): Promise<void> => {
  const res = await apiClient.get(`/payments/${paymentId}/receipt`, { responseType: 'blob' });

  // Axios surfaces error bodies as text when a blob responseType is set;
  // parse JSON error payloads (e.g. 400 "only issued for department or
  // class dues") so the user sees the real message instead of a corrupt
  // "PDF" download.
  const contentType = String(res.headers?.['content-type'] ?? '');
  if (contentType.includes('application/json')) {
    const text = await (res.data as Blob).text();
    let message = 'Could not download receipt';
    try {
      const body = JSON.parse(text);
      if (body?.error) message = body.error;
    } catch {
      // not JSON — keep the generic message
    }
    throw new Error(message);
  }

  const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = receiptFileNameFromHeaders(res.headers) || `Receipt-${paymentId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

function receiptFileNameFromHeaders(headers: Record<string, unknown> | undefined): string | null {
  const disposition = String(headers?.['content-disposition'] ?? '');
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  return match ? decodeURIComponent(match[1].replace(/"/g, '')) : null;
}
