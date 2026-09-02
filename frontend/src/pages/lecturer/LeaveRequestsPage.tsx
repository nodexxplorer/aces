import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { useNotification } from '../../hooks/useNotification';
import { createLeaveRequest, listMyLeaveRequests, type LecturerLeave } from '../../api/lecturers';
import { getErrorMessage } from '../../utils/errors';
import { Send, Loader2 } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  approved: 'success',
  rejected: 'danger',
  pending: 'warning',
  cancelled: 'default',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'Sick Leave',
  annual: 'Annual Leave',
  study: 'Study Leave',
  compassionate: 'Compassionate Leave',
  other: 'Other',
};

const LeaveRequestsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [leaves, setLeaves] = useState<LecturerLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leave_type: 'sick', start_date: '', end_date: '', reason: '' });

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const data = await listMyLeaveRequests();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      notifyError('Error', getErrorMessage(err, 'Failed to load leave requests'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.start_date || !form.end_date || !form.reason.trim()) return;
    setSubmitting(true);
    try {
      await createLeaveRequest(form);
      success('Leave Submitted', 'Your leave request has been submitted for approval.');
      setForm({ leave_type: 'sick', start_date: '', end_date: '', reason: '' });
      fetchLeaves();
    } catch (err: unknown) {
      notifyError('Submission Failed', getErrorMessage(err, 'Could not submit leave request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Leave Requests</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Submit a leave of absence request and track its approval status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>New Request</CardTitle>
              <CardDescription>Submit for administrative approval</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Leave Type</label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value }))}
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                >
                  {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={form.start_date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((p) => ({ ...p, start_date: e.target.value }))
                  }
                  required
                />
                <Input
                  label="End Date"
                  type="date"
                  value={form.end_date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((p) => ({ ...p, end_date: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Reason</label>
                <textarea
                  placeholder="Provide a reason for your leave request..."
                  className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                  value={form.reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setForm((p) => ({ ...p, reason: e.target.value }))
                  }
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                isLoading={submitting}
                leftIcon={<Send className="w-4 h-4" />}
                disabled={submitting}
              >
                Submit Request
              </Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>My Leave History</CardTitle>
              <CardDescription>{loading ? 'Loading...' : `${leaves.length} request(s)`}</CardDescription>
            </CardHeader>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : leaves.length === 0 ? (
              <EmptyState title="No leave requests yet" description="Submit one using the form." />
            ) : (
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {leaves.map((lv) => (
                  <div key={lv.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-surface-900 dark:text-white">
                          {LEAVE_TYPE_LABELS[lv.leave_type] ?? lv.leave_type}
                        </span>
                        <Badge variant={STATUS_VARIANT[lv.status] ?? 'default'} className="text-[10px] capitalize">
                          {lv.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {new Date(lv.start_date).toLocaleDateString()} – {new Date(lv.end_date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{lv.reason}</p>
                    </div>
                    <span className="text-[10px] text-surface-400 shrink-0">
                      {lv.created_at ? new Date(lv.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestsPage;
