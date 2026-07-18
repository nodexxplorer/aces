import apiClient from './client';
import type { User, AuthTokens, LoginPayload } from '../types';

export const login = async (payload: LoginPayload) => {
  const { data } = await apiClient.post<{ data: { user: User; tokens: AuthTokens } }>('/auth/login', payload);
  return data.data;
};

export const logout = async () => {
  await apiClient.post('/auth/logout');
};

export const refreshToken = async () => {
  const { data } = await apiClient.post<{ data: AuthTokens }>('/auth/refresh', {});
  return data.data;
};

export const getMe = async () => {
  const { data } = await apiClient.get<{ data: User }>('/auth/me');
  return data.data;
};

export const forgotPassword = async (email: string) => {
  await apiClient.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token: string, password: string) => {
  await apiClient.post('/auth/reset-password', { token, password });
};
