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

export interface NextClassInfo {
  course_code: string;
  course_title: string;
  start_time: string;
  end_time: string;
  venue: string;
  day_of_week: string;
  time_until: string;
  class_type: string | null;
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
  next_class: NextClassInfo | null;
  today_classes: NextClassInfo[];
  announcements: AnnouncementItem[];
  recent_grades: RecentGradeItem[];
  notifications: NotifSummary | null;
  carryovers: number;
}

export const getStudentDashboard = async () => {
  const res = await apiClient.get('/dashboard/student');
  return unwrap<StudentDashboard>(res);
};
