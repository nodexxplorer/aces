import apiClient, { unwrap } from './client';

interface BackendRegistration {
  id: string;
  student_id: string;
  session_id: string;
  semester_id: string;
  total_units: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface BackendRegisteredCourse {
  id: string;
  registration_id: string;
  course_id: string;
  status: string;
  grade?: string;
  grade_point?: number;
  ca_score?: number;
  exam_score?: number;
  is_carryover: boolean;
  previous_attempt_id?: string;
  created_at: string;
  updated_at: string;
}

interface RegistrationWithCourses {
  registration: BackendRegistration;
  registered_courses: BackendRegisteredCourse[];
}

interface BackendRegistrationDetail {
  id: string;
  student_id: string;
  session_id: string;
  semester_id: string;
  total_units: number;
  status: string;
  created_at: string;
  updated_at: string;
  registered_courses: BackendRegisteredCourse[];
}

export interface CourseRegistration {
  id: string;
  studentId: string;
  sessionId: string;
  semesterId: string;
  totalUnits: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredCourse {
  id: string;
  registrationId: string;
  courseId: string;
  status: string;
  grade?: string;
  gradePoint?: number;
  caScore?: number;
  examScore?: number;
  isCarryover: boolean;
  previousAttemptId?: string;
  createdAt: string;
  updatedAt: string;
}

export const getActiveSessionAndSemester = async () => {
  const [sessionsRes] = await Promise.all([
    apiClient.get('/sessions', { params: { page_id: 1, page_size: 1 } }),
  ]);
  const sessionsData = unwrap<any>(sessionsRes);
  const sessions = Array.isArray(sessionsData) ? sessionsData : sessionsData?.data ?? [];
  if (sessions.length === 0) return { session: null, semester: null };
  const session = sessions[0];

  const semsRes = await apiClient.get(`/sessions/${session.id}/semesters`);
  const semsData = unwrap<any>(semsRes);
  const semesters = Array.isArray(semsData) ? semsData : semsData?.data ?? [];
  if (semesters.length === 0) return { session, semester: null };

  const now = new Date().toISOString();
  const activeSem = semesters.find((s: any) => {
    const start = s.start_date || s.startDate || '';
    const end = s.end_date || s.endDate || '';
    if (start && end) return now >= start && now <= end;
    return true;
  }) || semesters[semesters.length - 1];

  return { session, semester: activeSem };
};

export const submitRegistration = async (payload: {
  session_id: string;
  semester_id: string;
  course_ids: string[];
}) => {
  const res = await apiClient.post('/course-registrations/submit', payload);
  return unwrap<RegistrationWithCourses>(res);
};

export const getStudentRegistrations = async (studentId: string) => {
  const res = await apiClient.get(`/course-registrations/student/${studentId}`);
  const raw = unwrap<BackendRegistrationDetail[] | { data: BackendRegistrationDetail[] }>(res);
  return Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
};

export const getRegistrationById = async (registrationId: string) => {
  const res = await apiClient.get(`/course-registrations/${registrationId}`);
  return unwrap<BackendRegistrationDetail>(res);
};

export const getRegisteredCourses = async (registrationId: string) => {
  const res = await apiClient.get(`/course-registrations/${registrationId}/courses`);
  const raw = unwrap<BackendRegisteredCourse[] | { data: BackendRegisteredCourse[] }>(res);
  return Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
};
