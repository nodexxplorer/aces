import apiClient, { unwrap } from './client';
import type { CGPAConfig } from '../types';

export interface ApprovedResultDetail {
  course_id: string;
  course_code: string;
  course_title: string;
  unit: number;
  score: number;
  grade: string;
  grade_point: number;
}

export interface SimulatedCourse {
  course_id: string;
  course_code: string;
  course_title: string;
  unit: number;
  grade: string;
  grade_point: number;
  is_override: boolean;
}

export interface CGPASimulation {
  current_cgpa: number;
  projected_cgpa: number;
  total_units: number;
  breakdown: SimulatedCourse[];
}

export const getMyApprovedResults = async () => {
  const res = await apiClient.get('/cgpa/my-results');
  return unwrap<ApprovedResultDetail[]>(res);
};

export const simulateCgpa = async (overrides: { course_id: string; score: number }[]) => {
  const res = await apiClient.post('/cgpa/simulate', { overrides });
  return unwrap<CGPASimulation>(res);
};

export const getCGPAConfig = async () => {
  const res = await apiClient.get('/cgpa/settings');
  return unwrap<CGPAConfig>(res);
};

// PUT /cgpa/settings responds with a plain confirmation message, not the
// updated config, so there's nothing to unwrap here — callers that need the
// fresh config should re-fetch via getCGPAConfig().
export const updateCGPAConfig = async (payload: Partial<CGPAConfig>) => {
  await apiClient.put('/cgpa/settings', payload);
};

export const calculateStudentCGPA = async (studentId: string) => {
  const res = await apiClient.get(`/cgpa/calculate/${studentId}`);
  return unwrap<{ cgpa: number; totalCredits: number; totalGradePoints: number }>(res);
};
