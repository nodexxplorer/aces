import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import {
  Database, Download, Upload, RefreshCw, Loader2, AlertTriangle,
  CheckCircle, XCircle, HardDrive, Clock,
} from 'lucide-react';
import { getBackups, createBackup, restoreBackup, getBackupSummary, type BackupRecord, type BackupSummary } from '../../api/backups';

const BackupPage = () => {
  const { success, warning, error: notifyError } = useNotification();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [b, s] = await Promise.allSettled([getBackups(), getBackupSummary()]);
      if (b.status === 'fulfilled') {
        const items = Array.isArray(b.value) ? b.value : (b.value as any)?.items || [];
        setBackups(items);
      }
      if (s.status === 'fulfilled') setSummary(s.value);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBacking(true);
      const result = await createBackup();
      success('Backup Complete', `Backup "${result?.file_name || 'system backup'}" has been created`);
      fetchData();
    } catch (err: any) {
      notifyError('Backup Failed', err?.response?.data?.error || 'Could not create backup');
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) {
      warning('No Backup Selected', 'Please select a backup to restore from');
      return;
    }
    if (!restoreConfirm) {
      setRestoreConfirm(true);
      return;
    }
    try {
      setRestoring(true);
      await restoreBackup(selectedBackup);
      success('Restore Initiated', 'System restore has been started. You will be notified when complete.');
      setRestoreConfirm(false);
      setSelectedBackup('');
      fetchData();
    } catch (err: any) {
      notifyError('Restore Failed', err?.response?.data?.error || 'Could not restore from backup');
    } finally {
      setRestoring(false);
    }
  };

  const lastBackup = backups.length > 0 ? backups[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Backup & Restore</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create snapshots and restore the system to a previous state.
          </p>
        </div>
        <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={fetchData}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading backups...</span>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary?.total_backups ?? backups.length}</p>
                <p className="text-[10px] text-surface-500">Total Backups</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary?.completed_count ?? 0}</p>
                <p className="text-[10px] text-surface-500">Completed</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-danger-50 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-danger-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary?.failed_count ?? 0}</p>
                <p className="text-[10px] text-surface-500">Failed</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info-50 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-info-600" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary?.total_size_mb?.toFixed(1) ?? '0'}</p>
                <p className="text-[10px] text-surface-500">Size (MB)</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-primary-500" />
                  Create New Backup
                </CardTitle>
                <CardDescription>Snapshot the current system state</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0 space-y-4">
                <Button
                  className="w-full"
                  isLoading={backing}
                  leftIcon={backing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  onClick={handleBackup}
                >
                  Create Backup Now
                </Button>
                {lastBackup && (
                  <div className="flex items-center gap-2 text-[10px] text-surface-500 justify-center">
                    <Clock className="w-3 h-3" />
                    Last backup: {lastBackup.file_name} ({new Date(lastBackup.created_at).toLocaleString()})
                  </div>
                )}
              </div>
            </Card>

            {/* Restore */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-warning-500" />
                  System Restore
                </CardTitle>
                <CardDescription>Restore to a previous backup state</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0 space-y-4">
                <div className="p-3 rounded-lg bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning-800 dark:text-warning-300">
                      {restoreConfirm ? 'Final Confirmation' : 'Warning'}
                    </p>
                    <p className="text-[10px] text-warning-600 dark:text-warning-400">
                      {restoreConfirm
                        ? 'This will permanently overwrite ALL current data. Type nothing and click Restore to confirm.'
                        : 'Restoring from backup will overwrite all current data. This action cannot be undone.'}
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  variant={restoreConfirm ? 'danger' : 'outline'}
                  isLoading={restoring}
                  leftIcon={restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  onClick={handleRestore}
                  disabled={!selectedBackup}
                >
                  {restoreConfirm ? 'Confirm Restore (Irreversible)' : selectedBackup ? 'Restore from Selected Backup' : 'Select a backup to restore'}
                </Button>
                {restoreConfirm && (
                  <Button variant="ghost" className="w-full" onClick={() => setRestoreConfirm(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Backup History */}
          {backups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-surface-500" />
                  Backup History
                </CardTitle>
                <CardDescription>{backups.length} backup(s) &middot; Select one to restore</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0 space-y-2 max-h-[400px] overflow-y-auto">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      selectedBackup === b.id
                        ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/10'
                        : 'border-surface-200 dark:border-surface-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-primary-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{b.file_name}</p>
                        <p className="text-[10px] text-surface-500">
                          {new Date(b.created_at).toLocaleString()}
                          {b.size_mb ? ` · ${b.size_mb} MB` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={b.status} />
                      <Button
                        size="xs"
                        variant={selectedBackup === b.id ? 'primary' : 'outline'}
                        onClick={() => {
                          setSelectedBackup(b.id);
                          setRestoreConfirm(false);
                        }}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default BackupPage;
