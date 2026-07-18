import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { FileText, Printer, Download, Eye, Loader2, Send } from 'lucide-react';
import { getTranscriptRequests, approveTranscriptRequest, markTranscriptPrinted } from '../../api/transcripts';
import type { TranscriptRequest, TranscriptStatus } from '../../types';

const TranscriptQueuePage = () => {
  const { success } = useNotification();
  const [requests, setRequests] = useState<TranscriptRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<TranscriptRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await getTranscriptRequests();
      const items = Array.isArray(data) ? data : (data as any).items || [];
      setRequests(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      await approveTranscriptRequest(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'approved' as TranscriptStatus } : r)));
      success('Request Approved', 'Student can now collect transcript');
      setViewOpen(false);
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPrinted = async (id: string) => {
    try {
      setActionLoading(id);
      await markTranscriptPrinted(id);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'printed' as TranscriptStatus } : r)));
      success('Marked Printed', 'Transcript ready for collection');
      setViewOpen(false);
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = (req: TranscriptRequest) => {
    setSelected(req);
    setViewOpen(true);
  };

  const columns = [
    {
      key: 'studentId',
      label: 'Student',
      render: (_: unknown, row: TranscriptRequest) => (
        <div>
          <p className="font-semibold">{row.studentName || 'Student'}</p>
          <p className="text-[10px] text-surface-500 font-mono">{row.studentId}</p>
        </div>
      ),
    },
    { key: 'purpose', label: 'Purpose' },
    { key: 'copies', label: 'Copies', render: (val: unknown) => val || 1 },
    {
      key: 'requestedAt',
      label: 'Requested',
      render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A',
    },
    {
      key: 'estimatedCost',
      label: 'Cost',
      render: (val: unknown) => val ? `₦${Number(val).toLocaleString()}` : 'N/A',
    },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: TranscriptRequest) => (
        <Button size="xs" variant="ghost" leftIcon={<Eye className="w-3.5 h-3.5" />} onClick={() => openDetail(row)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Transcript Queue</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage student transcript requests from submission through printing and collection.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-primary-600">
            {requests.filter((r) => r.status === 'pending').length}
          </p>
          <p className="text-xs text-surface-500 mt-1">Pending Review</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-warning-600">
            {requests.filter((r) => r.status === 'approved').length}
          </p>
          <p className="text-xs text-surface-500 mt-1">Approved / Printing</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-3xl font-bold text-success-600">
            {requests.filter((r) => r.status === 'printed' || r.status === 'collected').length}
          </p>
          <p className="text-xs text-surface-500 mt-1">Printed / Collected</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
          <CardDescription>All transcript requests and their current status</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading requests...</span>
          </div>
        ) : (
          <DataTable columns={columns as any} data={requests as any} />
        )}
      </Card>

      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Transcript Request Details">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-surface-500">Student</p>
                <p className="font-semibold">{selected.studentName || 'Student'}</p>
                <p className="text-xs text-surface-400">{selected.studentId}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Status</p>
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <p className="text-xs text-surface-500">Purpose</p>
                <p className="font-semibold">{selected.purpose}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Copies</p>
                <p className="font-semibold">{selected.copies || 1}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              {selected.status === 'pending' && (
                <Button
                  variant="success"
                  className="flex-1"
                  leftIcon={actionLoading === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  onClick={() => handleApprove(selected.id)}
                  disabled={actionLoading === selected.id}
                >
                  Approve Request
                </Button>
              )}
              {selected.status === 'approved' && (
                <Button
                  variant="success"
                  className="flex-1"
                  leftIcon={actionLoading === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  onClick={() => handleMarkPrinted(selected.id)}
                  disabled={actionLoading === selected.id}
                >
                  Mark as Printed
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TranscriptQueuePage;
