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
  created_by: string;
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

export const verifyPayment = async (paymentId: string, verifiedBy: string) => {
  const res = await apiClient.post(`/payments/${paymentId}/verify`, { verified_by: verifiedBy });
  return unwrap<Payment>(res);
};

export const updatePaymentStatus = async (paymentId: string, status: string) => {
  const res = await apiClient.put(`/payments/${paymentId}/status`, { status });
  return unwrap<Payment>(res);
};

export const checkDuePaid = async (dueId: string, studentId: string) => {
  const res = await apiClient.get('/payments/check-paid', { params: { due_id: dueId, student_id: studentId } });
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

// ─── Cart ───────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string;
  student_id: string;
  due_id: string;
  amount: number;
  added_at: string;
}

export const addToCart = async (studentId: string, dueId: string, amount: number) => {
  const res = await apiClient.post('/payments/cart', {
    student_id: studentId,
    due_id: dueId,
    amount: String(amount),
  });
  return unwrap<CartItem>(res);
};

export const listStudentCart = async (studentId: string) => {
  const res = await apiClient.get(`/payments/cart/${studentId}`);
  return unwrap<CartItem[]>(res);
};

export const removeFromCart = async (cartItemId: string) => {
  await apiClient.delete(`/payments/cart/${cartItemId}`);
};

export const clearStudentCart = async (studentId: string) => {
  await apiClient.delete(`/payments/cart/student/${studentId}`);
};
