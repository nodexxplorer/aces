import apiClient, { unwrap } from './client';

export interface GPAGrade {
  course_code: string;
  credits: number;
  total_score: number;
  grade_points: number;
  grade_letter: string;
}

export interface GPAPrediction {
  student_id: string;
  grades: GPAGrade[];
  total_credits: number;
  predicted_gpa: number;
  total_courses: number;
}

export interface AtRiskStudent {
  student_id: string;
  full_name: string;
  matric_number: string;
  level: number;
  cgpa: number;
  attendance_rate: number;
  failing_count: number;
  course_count: number;
  outstanding_dues: number;
  risk_level: 'critical' | 'high' | 'medium' | 'low';
  risk_reason: string;
}

export interface RevenueForecast {
  avg_monthly: number;
  max_monthly: number;
  min_monthly: number;
  months_with_data: number;
  total_collected: number;
  projected_next_month: number;
  semester_total: number;
  total_expected: number;
  collection_rate: number;
}

export interface GradeDistribution {
  course_id: string;
  course_code: string;
  course_name: string;
  total_students: number;
  avg_score: number;
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_d: number;
  grade_e: number;
  grade_f: number;
  pass_rate: number;
}

export const getGPAPrediction = async () => {
  const res = await apiClient.get('/predictions/gpa');
  return unwrap<GPAPrediction>(res);
};

export const getAtRiskStudents = async (limit?: number) => {
  const params = limit ? { limit: String(limit) } : {};
  const res = await apiClient.get('/predictions/at-risk', { params });
  return unwrap<{ students: AtRiskStudent[]; stats: Record<string, number>; total: number }>(res);
};

export const getRevenueForecast = async () => {
  const res = await apiClient.get('/predictions/revenue');
  return unwrap<RevenueForecast>(res);
};

export const getGradeDistribution = async (courseId?: string) => {
  const params = courseId ? { course_id: courseId } : {};
  const res = await apiClient.get('/predictions/grade-distribution', { params });
  return unwrap<GradeDistribution[]>(res);
};

export const getCoursePassRate = async (courseId: string) => {
  const res = await apiClient.get(`/predictions/pass-rate/${courseId}`);
  return unwrap<{ pass_rate: number; total_students: number; at_risk_count: number; avg_score: number }>(res);
};
