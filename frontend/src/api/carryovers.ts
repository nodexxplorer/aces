import apiClient, { unwrap } from './client';

export interface CarryoverCourseDetailed {
  id: string;
  student_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  unit: number;
  original_session_id: string;
  original_session_name: string;
  attempt_count: number;
  max_attempts: number;
  is_resolved: boolean;
  resolved_result_id: string | null;
  created_at: string;
}

export const getMyCarryovers = async (studentId: string) => {
  const res = await apiClient.get(`/carryovers/student/${studentId}/detailed`);
  return unwrap<CarryoverCourseDetailed[]>(res);
};
