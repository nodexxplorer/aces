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
}

export async function getStudentDashboard(): Promise<StudentDashboard> {
  const res = await apiClient.get('/dashboard/student');
  return unwrap<StudentDashboard>(res);
}
