import apiClient, { unwrap } from './client';

export interface LecturerProfile {
  id: string;
  user_id: string;
  staff_id: string;
  department: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  rank: string | null;
  specialization: string | null;
  employment_type: string | null;
  employment_status: string | null;
  qualifications: any[];
  bio: string | null;
  office_location: string | null;
  office_hours: any;
  date_joined: string | null;
  created_at: string | null;
}

export interface LecturerAssignment {
  id: string;
  lecturer_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  course_unit: number;
  level: number;
  session_id: string;
  semester: string;
  is_primary: boolean;
  assigned_by: string;
  assigned_by_name: string;
  created_at: string | null;
}

export interface LecturerLeave {
  id: string;
  lecturer_id: string;
  lecturer_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  course_handover: any;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
}

export interface LecturerDashboardStats {
  courses_assigned: number;
  total_students: number;
  assignments: LecturerAssignment[];
}

export interface BursarDashboardStats {
  total_revenue: number;
  total_collected: number;
  total_outstanding: number;
  today_collection: number;
  today_transactions: number;
  pending_verifications: number;
  total_students: number;
  fully_paid_students: number;
  unpaid_students: number;
}

export interface PendingPayment {
  id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  level: number;
  due_id: string;
  due_name: string;
  amount: number;
  paystack_reference: string | null;
  payment_method: string;
  bank_reference: string | null;
  bank_name: string | null;
  status: string;
  created_at: string | null;
}

export interface RecentPayment {
  id: string;
  student_name: string;
  matric_number: string;
  due_name: string;
  amount: number;
  paystack_reference: string | null;
  payment_method: string;
  status: string;
  created_at: string | null;
}

export interface BursarDashboardResponse {
  stats: BursarDashboardStats;
  pending_payments: PendingPayment[];
  recent_payments: RecentPayment[];
  active_dues: number;
}

// ─── Lecturer Management ────────────────────────────────────────────────────

export async function listLecturers(): Promise<LecturerProfile[]> {
  const res = await apiClient.get('/lecturers');
  return unwrap<LecturerProfile[]>(res);
}

export async function getLecturerProfile(id: string): Promise<{ profile: LecturerProfile; assignments: LecturerAssignment[]; leaves: LecturerLeave[] }> {
  const res = await apiClient.get(`/lecturers/${id}`);
  return unwrap(res);
}

export async function updateLecturerProfile(id: string, data: {
  title?: string; first_name?: string; last_name?: string; rank?: string;
  specialization?: string; bio?: string; office_location?: string; office_hours?: string;
}): Promise<void> {
  await apiClient.put(`/lecturers/${id}`, data);
}

export async function assignCourseToLecturer(lecturerId: string, courseId: string, isPrimary?: boolean): Promise<void> {
  await apiClient.post('/lecturers/assign-course', {
    lecturer_id: lecturerId, course_id: courseId, is_primary: isPrimary !== false,
  });
}

export async function listLecturerAssignments(lecturerId: string): Promise<LecturerAssignment[]> {
  const res = await apiClient.get(`/lecturers/${lecturerId}/assignments`);
  return unwrap<LecturerAssignment[]>(res);
}

export async function removeCourseAssignment(assignmentId: string): Promise<void> {
  await apiClient.delete(`/lecturers/assignments/${assignmentId}`);
}

// ─── Leave ──────────────────────────────────────────────────────────────────

export async function createLeaveRequest(data: {
  leave_type: string; start_date: string; end_date: string;
  reason: string; course_handover?: string;
}): Promise<LecturerLeave> {
  const res = await apiClient.post('/lecturers/leave', data);
  return unwrap<LecturerLeave>(res);
}

export async function listMyLeaveRequests(): Promise<LecturerLeave[]> {
  const res = await apiClient.get('/lecturers/leave/mine');
  return unwrap<LecturerLeave[]>(res);
}

export async function listAllLeaveRequests(): Promise<LecturerLeave[]> {
  const res = await apiClient.get('/lecturers/leave');
  return unwrap<LecturerLeave[]>(res);
}

export async function updateLeaveStatus(leaveId: string, status: string): Promise<void> {
  await apiClient.put(`/lecturers/leave/${leaveId}/status`, { status });
}

// ─── Lecturer Dashboard ─────────────────────────────────────────────────────

export async function getLecturerDashboardStats(): Promise<LecturerDashboardStats> {
  const res = await apiClient.get('/lecturers/dashboard/stats');
  return unwrap<LecturerDashboardStats>(res);
}

// ─── Bursar Dashboard ───────────────────────────────────────────────────────

export async function getBursarDashboard(): Promise<BursarDashboardResponse> {
  const res = await apiClient.get('/bursar/dashboard');
  return unwrap<BursarDashboardResponse>(res);
}

export async function recordManualPayment(data: {
  student_id: string; due_id: string; amount: string;
  bank_reference?: string; bank_name?: string; notes?: string;
}): Promise<{ id: string; message: string }> {
  const res = await apiClient.post('/bursar/record-payment', data);
  return unwrap<{ id: string; message: string }>(res);
}
