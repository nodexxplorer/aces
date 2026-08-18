import apiClient, { unwrap } from './client';

export interface DuePayment {
  id: string;
  name: string;
  description?: string;
  type: string;
  amount: number;
  level?: number;
  deadline?: string;
  is_active: boolean;
}

export interface Payment {
  id: string;
  student_id: string;
  due_id?: string;
  type: string;
  item_name: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paystack_reference?: string;
  created_at: string;
  paid_at?: string;
  // Joined fields — populated on the bursar-facing ledger (getAllPayments),
  // absent on a student's own payment list.
  matric_number?: string;
  student_name?: string;
  due_name?: string;
}

export interface PaymentSummary {
  total_paid: number;
  total_pending: number;
  amount_paid: number;
  amount_pending: number;
}

export interface Defaulter {
  student_id: string;
  full_name: string;
  matric_number: string;
  level: number;
  unpaid_dues_count: number;
  total_outstanding: number;
}

export const getMyDues = async (level?: number) => {
  const res = await apiClient.get('/payments/dues/level', { params: { level } });
  return unwrap<DuePayment[]>(res);
};

export const getStudentPayments = async (studentId: string) => {
  const res = await apiClient.get(`/payments/student/${studentId}`, { params: { limit: 100, offset: 0 } });
  return unwrap<Payment[]>(res);
};

export const getStudentPaymentSummary = async (studentId: string) => {
  const res = await apiClient.get(`/payments/summary/${studentId}`);
  return unwrap<PaymentSummary>(res);
};

// ─── Bursar (dues management, payment ledger, defaulters) ─────────────────

export const getAllDues = async () => {
  const res = await apiClient.get('/payments/dues', { params: { limit: 100, offset: 0 } });
  return unwrap<DuePayment[]>(res);
};

export const createDue = async (payload: {
  name: string;
  description?: string;
  type: string;
  amount: string;
  level?: number;
}) => {
  const res = await apiClient.post('/payments/dues', payload);
  return unwrap<DuePayment>(res);
};

export const deleteDue = async (dueId: string) => {
  await apiClient.delete(`/payments/dues/${dueId}`);
};

export const getAllPayments = async () => {
  const res = await apiClient.get('/payments', { params: { limit: 200, offset: 0 } });
  return unwrap<Payment[]>(res);
};

export const getDefaulters = async () => {
  const res = await apiClient.get('/payments/defaulters');
  return unwrap<Defaulter[]>(res);
};
