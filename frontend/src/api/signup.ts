import apiClient, { setCsrfToken } from './client';
import type { User, AuthTokens, StudentSignupPayload, LecturerSignupPayload } from '../types';

export const studentSignup = async (payload: StudentSignupPayload) => {
  const { data } = await apiClient.post<{ data: { user: User; tokens: AuthTokens } }>('/auth/signup/student', payload);
  setCsrfToken(data.data.tokens.csrfToken);
  return data.data;
};

export const lecturerSignup = async (payload: LecturerSignupPayload) => {
  const { data } = await apiClient.post<{ data: { user: User; tokens: AuthTokens } }>('/auth/signup/lecturer', payload);
  setCsrfToken(data.data.tokens.csrfToken);
  return data.data;
};
