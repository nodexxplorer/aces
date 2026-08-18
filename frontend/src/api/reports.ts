import apiClient, { unwrap } from './client';

export type ReportType = 'grade_distribution' | 'revenue_forecast' | 'at_risk_students';

export interface GeneratedReport {
  id: string;
  title: string;
  report_type: string;
  format: string;
  file_url: string | null;
  status: string;
  generated_by: string;
  row_count: number;
  created_at: string;
  completed_at: string | null;
}

export const generateReport = async (reportType: ReportType) => {
  const res = await apiClient.post('/reports', { report_type: reportType });
  return res.data as GeneratedReport;
};

export const listReports = async () => {
  const res = await apiClient.get('/reports');
  return unwrap<GeneratedReport[]>(res);
};
