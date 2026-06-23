import apiClient from './client';
import type { CGPAConfig } from '../types';

export const getCGPAConfig = async () => {
  const { data } = await apiClient.get<{ data: CGPAConfig }>('/cgpa/config');
  return data.data;
};

export const updateCGPAConfig = async (payload: Partial<CGPAConfig>) => {
  const { data } = await apiClient.put<{ data: CGPAConfig }>('/cgpa/config', payload);
  return data.data;
};

export const calculateStudentCGPA = async (studentId: string) => {
  const { data } = await apiClient.get<{ data: { cgpa: number; totalCredits: number; totalGradePoints: number } }>(`/cgpa/calculate/${studentId}`);
  return data.data;
};
