import apiClient from './client';
import type { Payment, DuePayment, PaginationParams, PaginatedResponse } from '../types';

export const getMyPayments = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Payment> }>('/payments/my', { params });
  return data.data;
};

export const getAllPayments = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Payment> }>('/payments', { params });
  return data.data;
};

export const getMyDues = async () => {
  const { data } = await apiClient.get<{ data: DuePayment[] }>('/payments/dues/my');
  return data.data;
};

export const getAllDues = async (params?: PaginationParams) => {
  const { data } = await apiClient.get<{ data: PaginatedResponse<DuePayment> }>('/payments/dues', { params });
  return data.data;
};

export const createDue = async (payload: Omit<DuePayment, 'id' | 'createdAt' | 'isPaid' | 'paymentId'>) => {
  const { data } = await apiClient.post<{ data: DuePayment }>('/payments/dues', payload);
  return data.data;
};

export const verifyPayment = async (reference: string) => {
  const { data } = await apiClient.post<{ data: Payment }>('/payments/verify', { reference });
  return data.data;
};

export const markManualPayment = async (userId: string, amount: number, purpose: string) => {
  const { data } = await apiClient.post<{ data: Payment }>('/payments/manual', { userId, amount, purpose });
  return data.data;
};

export const getDefaulters = async (dueId: string) => {
  const { data } = await apiClient.get<{ data: { userId: string; name: string; amount: number }[] }>(`/payments/dues/${dueId}/defaulters`);
  return data.data;
};
