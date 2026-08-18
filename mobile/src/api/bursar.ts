import apiClient, { unwrap } from './client';

// Mirrors frontend/src/api/lecturers.ts's bursar section and
// frontend/src/api/payments.ts's verifyPayment — same backend endpoints,
// trimmed to what the mobile bursar hub needs. Scoped to "verify payments"
// specifically for this first pass (same scoping call as the class-rep
// section: the single most on-the-go, mobile-natural bursar task), not a
// full port of the web bursar dashboard's dues/defaulters/manual-recording
// tools.

export interface PendingPayment {
  id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  level: number;
  due_id: string | null;
  due_name: string;
  amount: number;
  paystack_reference: string | null;
  payment_method: string;
  bank_reference: string | null;
  bank_name: string | null;
  status: string;
  created_at: string | null;
}

export interface BursarDashboardStats {
  total_revenue: number;
  total_collected: number;
  total_outstanding: number;
  today_collection: number;
  today_transactions: number;
  total_students: number;
  fully_paid_students: number;
  unpaid_students: number;
}

export interface BursarDashboardResponse {
  stats: BursarDashboardStats;
  pending_payments: PendingPayment[];
  recent_payments: unknown[];
  active_dues: number;
}

export const getBursarDashboard = async () => {
  const res = await apiClient.get('/bursar/dashboard');
  return unwrap<BursarDashboardResponse>(res);
};

export const verifyPayment = async (paymentId: string) => {
  const res = await apiClient.post(`/payments/${paymentId}/verify`);
  return unwrap<{ message: string }>(res);
};
