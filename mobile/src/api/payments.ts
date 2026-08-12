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
}

export interface PaymentSummary {
  total_paid: number;
  total_pending: number;
  amount_paid: number;
  amount_pending: number;
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
