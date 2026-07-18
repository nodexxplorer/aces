import apiClient, { unwrap } from './client';
import type { AnalyticsData } from '../types';

export interface AnalyticsEnrollment {
  level: string;
  count: number;
}

export interface AnalyticsCGPADistribution {
  range: string;
  count: number;
}

export interface AnalyticsComplaintStatus {
  status: string;
  count: number;
}

export interface AnalyticsOverview {
  total_students: number;
  total_courses: number;
  total_complaints: number;
  open_complaints: number;
  total_payments: number;
  total_revenue: number;
  pending_payments: number;
  total_results: number;
  total_backups: number;
  active_users: number;
  enrollment_by_level: AnalyticsEnrollment[];
  cgpa_distribution: AnalyticsCGPADistribution[];
  complaints_by_status: AnalyticsComplaintStatus[];
}

export const getDashboardAnalytics = async () => {
  const res = await apiClient.get('/analytics/dashboard');
  return unwrap<AnalyticsData>(res);
};

export const getDashboardStats = async () => {
  const res = await apiClient.get('/analytics/dashboard');
  return unwrap<Record<string, number>>(res);
};

export const getRecentUsers = async (limit?: number) => {
  const res = await apiClient.get('/analytics/users', { params: { limit: limit || 5 } });
  return unwrap<{ id: string; fullName: string; email: string; role: string; createdAt: string }[]>(res) ?? [];
};

export const getRecentActivity = async () => {
  const res = await apiClient.get('/analytics/activity');
  return unwrap<{ id: string; type: string; message: string; createdAt: string }[]>(res) ?? [];
};

export const getPerformanceTrend = async () => {
  const res = await apiClient.get('/analytics/performance');
  return unwrap<{ session: string; averageCGPA: number; passRate: number }[]>(res) ?? [];
};

export const getAnalyticsOverview = async () => {
  const res = await apiClient.get('/analytics/overview');
  return unwrap<AnalyticsOverview>(res);
};

export const getAnalyticsTrend = async (days?: number) => {
  const res = await apiClient.get('/analytics/trend', { params: { days } });
  return unwrap<AnalyticsEnrollment[]>(res) ?? [];
};
