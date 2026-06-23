import apiClient from './client';
import type { User, StudentSignupPayload, LecturerSignupPayload } from '../types';

export const studentSignup = async (payload: StudentSignupPayload) => {
  const { data } = await apiClient.post<{ data: User }>('/auth/signup/student', payload);
  return data.data;
};

export const lecturerSignup = async (payload: LecturerSignupPayload) => {
  const { data } = await apiClient.post<{ data: User }>('/auth/signup/lecturer', payload);
  return data.data;
};
