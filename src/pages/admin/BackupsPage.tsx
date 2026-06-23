import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import { useNotification } from '../../hooks/useNotification';
import { Database, Download, RotateCcw, Plus } from 'lucide-react';

interface BackupRecord {
  id: string;
  fileName: string;
  fileSize: string;
  creator: string;
  createdAt: string;
}

const mockBackups: BackupRecord[] = [
  { id: 'b-1', fileName: 'aces_db_backup_2026-06-20.sql', fileSize: '14.2 MB', creator: 'System Cron', createdAt: '2026-06-20 02:00' },
];

const BackupsPage = () => {
  const { success } = useNotification();
  const [backups, setBackups] = useState<BackupRecord[]>(mockBackups);
  const [backingUp, setBackingUp] = useState(false);

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const newBackup: BackupRecord = {
        id: `b-${Date.now()}`,
        fileName: `aces_db_backup_${new Date().toISOString().split('T')[0]}_manual.sql`,
        fileSize: '14.5 MB',
        creator: 'Admin (HOD)',
        createdAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString().slice(0, 5),
      };
      setBackups((prev) => [newBackup, ...prev]);
      success('Backup Created', 'Database snapshot exported successfully.');
    } finally {
      setBackingUp(false);
    }
  };

  const columns = [
    { key: 'fileName', label: 'Backup Target File', render: (val: unknown) => <span className="font-semibold">{val as string}</span> },
    { key: 'fileSize', label: 'Snapshot Size' },
    { key: 'creator', label: 'Operator' },
    { key: 'createdAt', label: 'Timestamp' },
    {
      key: 'action',
      label: 'Actions',
      render: (_: unknown, row: BackupRecord) => (
        <div className="flex gap-2">
          <Button size="xs" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />}>
            Download
          </Button>
          <Button size="xs" variant="outline" className="text-warning-500" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={() => success('Restore Complete', 'Restored system database status to snapshot state.')}>
            Restore
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">System Backups</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Generate snapshots, download database schema backups, and restore database tables.
          </p>
        </div>
        <Button isLoading={backingUp} leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreateBackup}>
          Generate Snapshot
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary-500" />
            <CardTitle>Database Snapshots Logs</CardTitle>
          </div>
          <CardDescription>Records of automated and manual database backups</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={backups as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default BackupsPage;
