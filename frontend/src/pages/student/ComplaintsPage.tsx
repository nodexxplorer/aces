import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import {
  submitComplaint,
  getMyComplaints,
  getComplaintHistory,
  type ComplaintStatusHistoryEntry,
} from '../../api/complaints';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Send, Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react';
import type { Complaint } from '../../types';

const STAGE_ORDER = ['open', 'in_review', 'resolved'] as const;
const STAGE_LABELS: Record<string, string> = {
  open: 'Submitted',
  in_review: 'Under Review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

const ComplaintsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [category, setCategory] = useState('result_error');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [history, setHistory] = useState<ComplaintStatusHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    setLoading(true);
    getMyComplaints()
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as { data?: Complaint[] } | undefined)?.data ?? []);
        setComplaints(list);
      })
      .catch(() => notifyError('Error', 'Failed to load complaints'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !desc) return;
    setSubmitting(true);
    try {
      await submitComplaint({
        subject: title,
        description: desc,
        category,
        priority: 'medium',
      });
      setTitle('');
      setDesc('');
      success('Ticket Opened', 'Your complaint ticket has been submitted to department administration.');
      if (user?.id) {
        getMyComplaints().then((res) => {
          const list = Array.isArray(res) ? res : ((res as { data?: Complaint[] } | undefined)?.data ?? []);
          setComplaints(list);
        });
      }
    } catch {
      notifyError('Failed', 'Unable to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRowClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setLoadingHistory(true);
    getComplaintHistory(complaint.id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  };

  const columns = [
    { key: 'category', label: 'Category' },
    {
      key: 'subject',
      label: 'Subject',
      render: (val: unknown) => <span className="font-medium">{(val as string) || 'N/A'}</span>,
    },
    {
      key: 'created_at',
      label: 'Filed Date',
      render: (val: unknown) => (val ? new Date(val as string).toLocaleDateString() : 'N/A'),
    },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Complaints & Tickets</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Open and monitor support tickets for academic results, registration or transaction errors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Log</CardTitle>
              <CardDescription>Records of filed complaints and administrative replies</CardDescription>
            </CardHeader>
            <DataTable
              columns={columns}
              data={complaints as unknown as Record<string, unknown>[]}
              onRowClick={(row) => handleRowClick(row as unknown as Complaint)}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit Complaint</CardTitle>
              <CardDescription>File a new ticket for support staff review</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
              <Select
                label="Category"
                options={[
                  { value: 'result_error', label: 'Result Discrepancy' },
                  { value: 'payment_issue', label: 'Payment gateway error' },
                  { value: 'attendance_dispute', label: 'Timetable conflict' },
                  { value: 'other', label: 'Other' },
                ]}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <Input
                label="Subject"
                placeholder="e.g. Grade discrepancy for CPE 511"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                <textarea
                  placeholder="Provide precise details, including course codes, payment dates, or references..."
                  className="w-full h-32 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Send className="w-4 h-4" />}>
                Submit Ticket
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={!!selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        title={selectedComplaint?.subject || 'Complaint Timeline'}
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-surface-500 dark:text-surface-400">{selectedComplaint?.description}</p>
            <div className="space-y-0">
              {STAGE_ORDER.map((stage, i) => {
                const entry = history.find((h) => h.to_status === stage);
                const currentStatus = selectedComplaint?.status;
                const isRejected = currentStatus === 'rejected';
                const reachedIndex = STAGE_ORDER.indexOf((currentStatus as (typeof STAGE_ORDER)[number]) || 'open');
                const isReached = !isRejected && i <= reachedIndex;
                const isLast = i === STAGE_ORDER.length - 1;
                return (
                  <div key={stage} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {isReached ? (
                        <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-surface-300 dark:text-surface-600 shrink-0" />
                      )}
                      {!isLast && (
                        <div
                          className={`w-px flex-1 my-1 ${isReached ? 'bg-success-300' : 'bg-surface-200 dark:bg-surface-700'}`}
                        />
                      )}
                    </div>
                    <div className="pb-6">
                      <p
                        className={`text-sm font-medium ${isReached ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400'}`}
                      >
                        {STAGE_LABELS[stage]}
                      </p>
                      {entry && (
                        <p className="text-xs text-surface-400 mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
                      )}
                      {entry?.note && (
                        <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 italic">"{entry.note}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {selectedComplaint?.status === 'rejected' && (
                <div className="flex gap-3">
                  <XCircle className="w-5 h-5 text-danger-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-danger-600">Rejected</p>
                    {history.find((h) => h.to_status === 'rejected')?.note && (
                      <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 italic">
                        "{history.find((h) => h.to_status === 'rejected')?.note}"
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ComplaintsPage;
