import { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { createLeaveRequest, listMyLeaveRequests, type LecturerLeave } from '../../api/lecturers';
import { getErrorMessage } from '../../utils/errors';
import { Loader2, Send } from 'lucide-react';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'Sick',
  conference: 'Conference',
  study: 'Study',
  personal: 'Personal',
  sabbatical: 'Sabbatical',
  maternity: 'Maternity',
  paternity: 'Paternity',
};

const STATUS_CLASS: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  active: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

function workingDays(start: string, end: string) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  let n = 0;
  const d = new Date(a);
  while (d <= b) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function formatRange(start: string, end: string) {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (a.toDateString() === b.toDateString()) return a.toLocaleDateString(undefined, opts);
  return `${a.toLocaleDateString(undefined, opts)} to ${b.toLocaleDateString(undefined, opts)}`;
}

const LeaveRequestsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [leaves, setLeaves] = useState<LecturerLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leave_type: 'sick',
    start_date: '',
    end_date: '',
    reason: '',
    course_handover: '',
  });

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

  const days = workingDays(form.start_date, form.end_date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.start_date || !form.end_date || !form.reason.trim()) return;
    setSubmitting(true);
    try {
      await createLeaveRequest({
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim(),
        course_handover: form.course_handover.trim()
          ? JSON.stringify({ cover: form.course_handover.trim() })
          : undefined,
      });
      success('Leave Submitted', 'Your leave request has been sent to the HOD.');
      setForm({ leave_type: 'sick', start_date: '', end_date: '', reason: '', course_handover: '' });
      fetchLeaves();
    } catch (err: unknown) {
      notifyError('Submission Failed', getErrorMessage(err, 'Could not submit leave request'));
    } finally {
      setSubmitting(false);
    }
  };

  const usedDays = useMemo(() => {
    return leaves
      .filter((l) => l.status === 'approved' || l.status === 'active' || l.status === 'completed')
      .reduce((sum, l) => sum + workingDays(l.start_date, l.end_date), 0);
  }, [leaves]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Leave requests</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Request time away. Your HOD approves it.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">New leave request</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type of leave</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, leave_type: value }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      form.leave_type === value
                        ? 'border-[#1d68ec] bg-[#1d68ec] text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">From</span>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">To</span>
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
                />
              </label>
            </div>
            {days > 0 && (
              <p className="text-xs text-slate-500">
                {days} working day{days === 1 ? '' : 's'}
              </p>
            )}

            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Who covers your classes? (optional)
              </span>
              <input
                value={form.course_handover}
                onChange={(e) => setForm((p) => ({ ...p, course_handover: e.target.value }))}
                placeholder="Name of the colleague covering your classes"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Reason</span>
              <textarea
                required
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                className="mt-1 w-full h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 resize-none"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1d68ec] text-white text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send to HOD
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">Leave used</h2>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{usedDays} days</p>
            <p className="text-xs text-slate-500 mt-1">Approved leave in your request history</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Your requests</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[#1d68ec]" />
              </div>
            ) : leaves.length === 0 ? (
              <p className="text-sm text-slate-500">No leave requests yet.</p>
            ) : (
              <div className="space-y-3">
                {leaves.map((lv) => {
                  const daysN = workingDays(lv.start_date, lv.end_date);
                  return (
                    <div key={lv.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {LEAVE_TYPE_LABELS[lv.leave_type] ?? lv.leave_type}
                            {daysN ? ` · ${daysN} day${daysN === 1 ? '' : 's'}` : ''}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatRange(lv.start_date, lv.end_date)}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                            STATUS_CLASS[lv.status] || STATUS_CLASS.pending
                          }`}
                        >
                          {lv.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestsPage;
