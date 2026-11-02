import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { listMyReports, submitClassRepReport, type ClassRepReport } from '../../api/class-rep';
import { getErrorMessage } from '../../utils/errors';
import { FileText, Send, Paperclip, Check, Eye, Clock, Plus } from 'lucide-react';

const REPORT_TYPES = [
  { id: 'attendance', label: 'Attendance summary' },
  { id: 'concern', label: 'Class concern' },
  { id: 'event', label: 'Event report' },
  { id: 'other', label: 'Other' },
] as const;

export default function ReportsPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [reports, setReports] = useState<ClassRepReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [reportType, setReportType] = useState<string>('concern');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await listMyReports();
      setReports(Array.isArray(res) ? res : []);
    } catch {
      notifyError('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSendToHOD = async (isDraft = false) => {
    if (!subject.trim()) {
      notifyError('Validation', 'Please provide a subject');
      return;
    }
    if (!details.trim()) {
      notifyError('Validation', 'Please provide details for the report');
      return;
    }

    try {
      setSubmitting(true);
      const level = user?.level || 0;
      await submitClassRepReport(reportType, subject.trim(), details.trim(), level, isDraft ? 'draft' : undefined);
      success(
        isDraft ? 'Draft Saved' : 'Report Sent',
        isDraft ? 'Your draft has been saved.' : 'Class report submitted directly to the Head of Department.',
      );
      setSubject('');
      setDetails('');
      setFileName(null);
      await fetchReports();
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to submit report'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Recent';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return 'Last week';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'resolved' || s === 'reviewed' || s === 'seen') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <Eye className="w-3.5 h-3.5" />
          Seen by HOD
        </span>
      );
    }
    if (s === 'submitted' || s === 'delivered' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
          <Check className="w-3.5 h-3.5" />
          Delivered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
        <Clock className="w-3.5 h-3.5" />
        Draft
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Reports</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Send class reports and concerns to the HOD.
        </p>
      </div>

      {/* Main Grid: New report on Left, Your reports on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
            <h2 className="text-base font-bold text-surface-900 dark:text-white mb-5">New report</h2>

            <div className="space-y-5">
              {/* Type of report pills */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Type of report
                </label>
                <div className="flex flex-wrap gap-2">
                  {REPORT_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReportType(t.id)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        reportType === t.id
                          ? 'bg-[#1d68ec] text-white shadow-md shadow-[#1d68ec]/20'
                          : 'bg-surface-100 dark:bg-[#152033] text-surface-700 dark:text-slate-300 hover:bg-surface-200 dark:hover:bg-[#1a2842] border border-surface-200 dark:border-[#223352]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Projector not working in LT 2"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
                />
              </div>

              {/* Details */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Details</label>
                <textarea
                  rows={5}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="The projector has not worked for two weeks. Students are struggling to follow the slides."
                  className="w-full px-4 py-3 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec] resize-none"
                />
              </div>

              {/* Attachment */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-surface-300 dark:border-[#223352] bg-surface-50/50 dark:bg-[#0b101c]/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Paperclip className="w-4 h-4 text-surface-400 dark:text-slate-400 shrink-0" />
                  <span className="text-xs text-surface-600 dark:text-slate-400 truncate">
                    {fileName ? fileName : 'Add a photo or file (optional)'}
                  </span>
                </div>
                <label className="px-3.5 py-1.5 rounded-lg bg-surface-200 dark:bg-[#1a2842] text-xs font-medium text-surface-700 dark:text-slate-200 hover:bg-surface-300 dark:hover:bg-[#223352] cursor-pointer transition-colors shrink-0">
                  Browse
                  <input type="file" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSendToHOD(true)}
                  className="px-5 py-2.5 rounded-xl border border-surface-300 dark:border-[#223352] text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSendToHOD(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#1d68ec]/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Sending...' : 'Send to HOD'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Your reports */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
            <h2 className="text-base font-bold text-surface-900 dark:text-white mb-4">Your reports</h2>

            {loading ? (
              <div className="py-12 text-center text-xs text-surface-400">Loading reports...</div>
            ) : reports.length === 0 ? (
              /* Clean empty state as shown in PDF */
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-[#152033] flex items-center justify-center text-surface-400 dark:text-slate-400 mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">No reports yet</p>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 max-w-[200px]">
                  Send a class report to the HOD.
                </p>
                <button
                  onClick={() => {
                    const el = document.querySelector('textarea');
                    el?.focus();
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#1d68ec]/10 text-[#1d68ec] dark:text-[#4f9bff] hover:bg-[#1d68ec]/20 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New report</span>
                </button>
              </div>
            ) : (
              /* Populated list with real reports */
              <div className="divide-y divide-surface-100 dark:divide-surface-800/80">
                {reports.map((r) => (
                  <div key={r.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033] text-[#1d68ec] shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{r.title}</p>
                        <p className="text-xs text-surface-400 dark:text-slate-500 mt-0.5">
                          {formatRelativeTime(r.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">{getStatusBadge(r.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
