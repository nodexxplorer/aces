import apiClient from './client';
import type { Manual, ManualPurchase } from '../types';

export const getManuals = async (params?: { level?: number; semester?: string; search?: string }) => {
  const { data } = await apiClient.get<{ data: Manual[] }>('/manuals', { params });
  return data.data;
};

export const getManual = async (manualId: string) => {
  const { data } = await apiClient.get<{ data: Manual }>(`/manuals/${manualId}`);
  return data.data;
};

export const createManual = async (formData: FormData) => {
  const { data } = await apiClient.post<{ data: Manual }>('/manuals', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const updateManual = async (manualId: string, payload: Partial<Manual>) => {
  const { data } = await apiClient.put<{ data: Manual }>(`/manuals/${manualId}`, payload);
  return data.data;
};

export const deleteManual = async (manualId: string) => {
  await apiClient.delete(`/manuals/${manualId}`);
};

export const purchaseManuals = async (manualIds: string[]) => {
  const { data } = await apiClient.post<{ data: ManualPurchase[] }>('/manuals/purchase', { manualIds });
  return data.data;
};

export const getMyPurchasedManuals = async () => {
  const { data } = await apiClient.get<{ data: ManualPurchase[] }>('/manuals/my-purchases');
  return data.data;
};

export const requestPrint = async (manualId: string) => {
  const { data } = await apiClient.post<{ data: { queueId: string; qrCode: string } }>(`/manuals/${manualId}/print-request`);
  return data.data;
};

export const getPrintQueue = async () => {
  const { data } = await apiClient.get<{ data: ManualPurchase[] }>('/manuals/print-queue');
  return data.data;
};
