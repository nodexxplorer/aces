import apiClient from './client';
import type { AnalyticsData } from '../types';

export const getDashboardAnalytics = async () => {
  const { data } = await apiClient.get<{ data: AnalyticsData }>('/analytics/dashboard');
  return data.data;
};

export const getPaymentAnalytics = async (params?: { from?: string; to?: string }) => {
  const { data } = await apiClient.get<{ data: { total: number; trend: { month: string; amount: number }[] } }>('/analytics/payments', { params });
  return data.data;
};

export const getResultAnalytics = async (sessionId?: string) => {
  const { data } = await apiClient.get<{ data: { gradeDistribution: { grade: string; count: number }[]; averageCGPA: number } }>('/analytics/results', { params: { sessionId } });
  return data.data;
};

export const getAttendanceAnalytics = async (courseId?: string) => {
  const { data } = await apiClient.get<{ data: { averageAttendance: number; perCourse: { courseId: string; name: string; percentage: number }[] } }>('/analytics/attendance', { params: { courseId } });
  return data.data;
};
