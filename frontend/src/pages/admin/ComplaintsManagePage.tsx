import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { MessageSquare, Loader2, Eye, CheckCircle, RotateCcw } from 'lucide-react';
import { getComplaints, updateComplaintStatus } from '../../api/complaints';

const ComplaintsManagePage = () => {
  const { success, error: notifyError } = useNotification();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await getComplaints();
      const items = Array.isArray(data) ? data : (data as any).items || [];
      setComplaints(items);
    } catch (err: any) {
      notifyError('Load Failed', err?.message || 'Could not load complaints');
    } finally {
      setLoading(false);
    }
  };

  const filtered = statusFilter === 'all'
    ? complaints
    : complaints.filter((c) => c.status === statusFilter);

  const handleResolve = async (id: string) => {
    try {
      setActionLoading(id);
      await updateComplaintStatus(id, 'resolved');
      setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'resolved' } : c)));
      success('Complaint Resolved', 'Marked as resolved');
      setViewOpen(false);
    } catch (err: any) {
      notifyError('Resolve Failed', err?.message || 'Could not resolve complaint');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopen = async (id: string) => {
    try {
      setActionLoading(id);
      await updateComplaintStatus(id, 'pending');
      setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'pending' } : c)));
      success('Complaint Reopened', 'Status reverted to pending');
      setViewOpen(false);
    } catch (err: any) {
      notifyError('Reopen Failed', err?.message || 'Could not reopen complaint');
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = (complaint: any) => {
    setSelectedComplaint(complaint);
    setViewOpen(true);
  };

  const columns = [
    {
      key: 'ticketNo',
      label: 'Ticket',
      render: (_: unknown, row: any) => (
        <span className="font-mono text-xs">{row.ticketNo || row.ticket_no || `CMP-${(row.id || '').slice(-6).toUpperCase()}`}</span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (val: unknown) => {
        const colors: Record<string, string> = {
          result_error: 'bg-primary-100 text-primary-700',
          payment_issue: 'bg-success-100 text-success-700',
          profile_issue: 'bg-warning-100 text-warning-700',
          attendance_dispute: 'bg-danger-100 text-danger-700',
          assignment_issue: 'bg-surface-100 text-surface-700',
          other: 'bg-surface-100 text-surface-500',
        };
        return (
          <span className={`text-[10px] px-2 py-1 rounded-full ${colors[val as string] || colors.other}`}>
            {(val as string || 'other').replace(/_/g, ' ')}
          </span>
        );
      },
    },
    { key: 'subject', label: 'Subject' },
    {
      key: 'created_at',
      label: 'Submitted',
      render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A',
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (val: unknown) => {
        const colors: Record<string, string> = {
          high: 'bg-danger-100 text-danger-700',
          critical: 'bg-danger-100 text-danger-700',
          medium: 'bg-warning-100 text-warning-700',
          low: 'bg-surface-100 text-surface-500',
        };
        return (
          <span className={`text-[10px] px-2 py-1 rounded-full ${colors[val as string] || colors.low}`}>
            {val as string}
          </span>
        );
      },
    },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" variant="ghost" leftIcon={<Eye className="w-3.5 h-3.5" />} onClick={() => openDetail(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Complaint Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Review, prioritize and resolve student and staff complaints.
          </p>
        </div>
        <Select
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Complaint Registry</CardTitle>
          <CardDescription>
            <MessageSquare className="inline w-4 h-4 mr-1" />
            {filtered.length} complaint{filtered.length !== 1 && 's'}
          </CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading complaints...</span>
          </div>
        ) : (
          <DataTable columns={columns} data={filtered as unknown as Record<string, unknown>[]} />
        )}
      </Card>

      <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Complaint Details">
        {selectedComplaint && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-surface-500">Category</p>
                <p className="font-semibold capitalize">{(selectedComplaint.category || 'other').replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Priority</p>
                <p className="font-semibold capitalize">{selectedComplaint.priority}</p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Status</p>
                <StatusBadge status={selectedComplaint.status} />
              </div>
              <div>
                <p className="text-xs text-surface-500">Submitted</p>
                <p className="font-semibold">
                  {selectedComplaint.created_at
                    ? new Date(selectedComplaint.created_at).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-surface-500">Subject</p>
              <p className="font-semibold">{selectedComplaint.subject}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500">Description</p>
              <p className="text-sm text-surface-700 dark:text-surface-300">
                {selectedComplaint.body || selectedComplaint.description || 'No description provided.'}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              {selectedComplaint.status !== 'resolved' && (
                <Button
                  variant="success"
                  className="flex-1"
                  leftIcon={actionLoading === selectedComplaint.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  onClick={() => handleResolve(selectedComplaint.id)}
                  disabled={actionLoading === selectedComplaint.id}
                >
                  Mark Resolved
                </Button>
              )}
              {selectedComplaint.status === 'resolved' && (
                <Button
                  variant="outline"
                  className="flex-1"
                  leftIcon={actionLoading === selectedComplaint.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  onClick={() => handleReopen(selectedComplaint.id)}
                  disabled={actionLoading === selectedComplaint.id}
                >
                  Reopen Complaint
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ComplaintsManagePage;
