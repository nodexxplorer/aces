import apiClient, { unwrap } from './client';

export interface StudentInfo {
  full_name: string;
  matric_number: string;
  level: number;
  cgpa: number | null;
  academic_standing: string | null;
}

export interface PaymentSummary {
  amount_pending: number;
  amount_paid: number;
  dues_outstanding: number;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  date: string;
}

export interface RecentGradeItem {
  course_code: string;
  course_title: string;
  score: number;
  grade: string | null;
  session_name: string;
  semester: string;
}

export interface NotifSummary {
  total: number;
  unread: number;
}

export interface StudentDashboard {
  student: StudentInfo | null;
  attendance: { total_classes: number; attended: number; attendance_rate: number } | null;
  payments: PaymentSummary | null;
  announcements: AnnouncementItem[];
  recent_grades: RecentGradeItem[];
  notifications: NotifSummary | null;
}

export const getStudentDashboard = async () => {
  const res = await apiClient.get('/dashboard/student');
  return unwrap<StudentDashboard>(res);
};
