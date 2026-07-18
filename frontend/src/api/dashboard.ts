import apiClient, { unwrap } from './client';

export interface StudentDashboard {
  student: {
    full_name: string;
    matric_number: string;
    level: number;
    cgpa: number | null;
    academic_standing: string | null;
  };
  attendance: {
    total_classes: number;
    attended: number;
    attendance_rate: number;
  };
  payments: {
    amount_pending: number;
    amount_paid: number;
    dues_outstanding: number;
  };
  next_class: {
    course_code: string;
    course_title: string;
    start_time: string;
    end_time: string;
    venue: string;
    day_of_week: string;
    time_until: string;
    class_type: string | null;
  } | null;
  today_classes: Array<{
    course_code: string;
    course_title: string;
    start_time: string;
    end_time: string;
    venue: string;
    class_type: string | null;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    is_pinned: boolean;
    date: string;
  }>;
  recent_grades: Array<{
    course_code: string;
    course_title: string;
    score: number;
    grade: string | null;
    session_name: string;
    semester: string;
  }>;
  notifications: {
    total: number;
    unread: number;
  };
  carryovers: number;
}

export async function getStudentDashboard(): Promise<StudentDashboard> {
  const res = await apiClient.get('/dashboard/student');
  return unwrap<StudentDashboard>(res);
}
