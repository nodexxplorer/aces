import apiClient, { unwrap } from './client';

export interface BackupRecord {
  id: string;
  file_name: string;
  s3_url: string;
  status: string;
  size_mb?: string;
  created_by?: string;
  created_at: string;
}

export interface BackupSummary {
  total_backups: number;
  completed_count: number;
  failed_count: number;
  total_size_mb: number;
}

export const getBackups = async () => {
  const res = await apiClient.get('/backups');
  return unwrap<BackupRecord[]>(res) ?? [];
};

export const getBackupSummary = async () => {
  const res = await apiClient.get('/backups/summary');
  return unwrap<BackupSummary>(res);
};

export const createBackup = async () => {
  const res = await apiClient.post('/backups');
  return unwrap<BackupRecord>(res);
};

export const restoreBackup = async (backupId: string) => {
  const res = await apiClient.post(`/backups/${backupId}/restore`);
  return unwrap<{ message: string }>(res);
};
