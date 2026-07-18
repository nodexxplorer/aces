import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Printer, Loader2, CheckCircle, Package } from 'lucide-react';
import { getManualPrintQueue, updatePrintQueueStatus } from '../../api/manuals';
import type { PrintQueueItem } from '../../api/manuals';

const ManualPrintQueuePage = () => {
  const { success, error: notifyError } = useNotification();
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchQueue();
  }, [statusFilter]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const data = await getManualPrintQueue(statusFilter || undefined);
      setQueue(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setActionLoading(id);
      await updatePrintQueueStatus(id, status);
      setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
      success('Updated', `Marked as ${status}`);
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.error || 'Could not update status');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      key: 'manual_title',
      label: 'Manual',
      render: (_: unknown, row: PrintQueueItem) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-50 flex items-center justify-center">
            <Printer className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold">{row.manual_title || 'Untitled Manual'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'student_name',
      label: 'Student',
      render: (_: unknown, row: PrintQueueItem) => (
        <div>
          <p className="text-sm font-medium">{row.student_name || 'Unknown'}</p>
          <p className="text-[10px] text-surface-500">{row.matric_number || ''}</p>
        </div>
      ),
    },
    {
      key: 'queued_at',
      label: 'Queued',
      render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A',
    },
    {
      key: 'status',
      label: 'Status',
      render: (val: unknown) => <StatusBadge status={val as string || 'queued'} />,
    },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: PrintQueueItem) => {
        if (row.status === 'queued') {
          return (
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="success"
                leftIcon={actionLoading === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                onClick={() => handleUpdateStatus(row.id, 'ready')}
                disabled={actionLoading === row.id}
              >
                Mark Ready
              </Button>
            </div>
          );
        }
        if (row.status === 'ready') {
          return (
            <div className="flex gap-2">
              <Button
                size="xs"
                variant="success"
                leftIcon={actionLoading === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                onClick={() => handleUpdateStatus(row.id, 'collected')}
                disabled={actionLoading === row.id}
              >
                Mark Collected
              </Button>
            </div>
          );
        }
        return <span className="text-[10px] text-success-600 font-medium capitalize">{row.status}</span>;
      },
    },
  ];

  const pendingCount = queue.filter((q) => q.status === 'queued').length;
  const readyCount = queue.filter((q) => q.status === 'ready').length;
  const collectedCount = queue.filter((q) => q.status === 'collected').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Manual Print Queue</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          View and fulfill print requests for departmental manuals and handbooks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-primary-600">{pendingCount}</p>
          <p className="text-xs text-surface-500 mt-1">Queued</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{readyCount}</p>
          <p className="text-xs text-surface-500 mt-1">Ready</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-success-600">{collectedCount}</p>
          <p className="text-xs text-surface-500 mt-1">Collected</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-surface-400">{queue.length}</p>
          <p className="text-xs text-surface-500 mt-1">Total</p>
        </Card>
      </div>

      <div className="flex gap-2">
        {['', 'queued', 'ready', 'printing', 'collected'].map((s) => (
          <Button
            key={s}
            size="xs"
            variant={statusFilter === s ? 'primary' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {s || 'All'}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary-500" />
            Print Queue
          </CardTitle>
          <CardDescription>Manual print requests awaiting fulfillment</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading queue...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <Printer className="w-8 h-8 mx-auto mb-2 text-surface-300" />
            <p>No print requests found.</p>
          </div>
        ) : (
          <DataTable columns={columns as any} data={queue as unknown as Record<string, unknown>[]} />
        )}
      </Card>
    </div>
  );
};

export default ManualPrintQueuePage;
