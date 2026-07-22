import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Eye, Ban } from 'lucide-react';
import { listCampusReports, updateCampusReportStatus, issueStrike } from '../../api/campus-connect-v2';
import { useNotification } from '../../hooks/useNotification';
import Button from '../../components/ui/Button';

interface Report {
  id: string;
  target_type: string;
  reason: string;
  description: string | null;
  reporter_id: string;
  status: string;
  action_taken?: string | null;
  created_at: string;
}

type FilterStatus = 'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export default function ModerationPage() {
  const { success, error: notifyError } = useNotification();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<Report | null>(null);
  const [actionTaken, setActionTaken] = useState('');
  const [strikeModal, setStrikeModal] = useState(false);
  const [strikeTarget, setStrikeTarget] = useState('');
  const [strikeReason, setStrikeReason] = useState('');
  const [strikeLoading, setStrikeLoading] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await listCampusReports(filter === 'all' ? undefined : filter);
      setReports(data as Report[]);
    } catch {
      notifyError('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const handleReview = async (report: Report) => {
    setActionLoading(report.id);
    try {
      await updateCampusReportStatus(report.id, 'reviewed');
      success('Report marked as reviewed');
      fetchReports();
    } catch {
      notifyError('Failed to update report status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    setActionLoading(resolveModal.id);
    try {
      await updateCampusReportStatus(resolveModal.id, 'resolved', actionTaken);
      success('Report resolved');
      setResolveModal(null);
      setActionTaken('');
      fetchReports();
    } catch {
      notifyError('Failed to resolve report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (report: Report) => {
    setActionLoading(report.id);
    try {
      await updateCampusReportStatus(report.id, 'dismissed');
      success('Report dismissed');
      fetchReports();
    } catch {
      notifyError('Failed to dismiss report');
    } finally {
      setActionLoading(null);
    }
  };

  const handleIssueStrike = async () => {
    if (!strikeTarget.trim() || !strikeReason.trim()) return;
    setStrikeLoading(true);
    try {
      await issueStrike(strikeTarget, strikeReason);
      success('Strike issued successfully');
      setStrikeModal(false);
      setStrikeTarget('');
      setStrikeReason('');
    } catch {
      notifyError('Failed to issue strike');
    } finally {
      setStrikeLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { color: string; text: string; bg: string }> = {
      pending: { color: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
      reviewed: { color: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
      resolved: { color: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
      dismissed: { color: 'bg-gray-400', text: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
    };
    const c = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.text} ${c.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Moderation</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review reports and issue strikes</p>
            </div>
          </div>
          <Button onClick={() => setStrikeModal(true)} variant="danger" className="flex items-center gap-2">
            <Ban className="w-4 h-4" />
            Issue Strike
          </Button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === f.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No reports found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                        #{report.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {report.target_type}
                      </span>
                      {statusBadge(report.status)}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{report.reason}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{report.description || ''}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 dark:text-gray-500">
                      <span>Reporter: {report.reporter_id.slice(0, 8)}...</span>
                      <span>{new Date(report.created_at).toLocaleDateString()}</span>
                      {report.action_taken && (
                        <span className="text-green-600 dark:text-green-400">
                          Action: {report.action_taken}
                        </span>
                      )}
                    </div>
                  </div>

                  {report.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        onClick={() => handleReview(report)}
                        disabled={actionLoading === report.id}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        {actionLoading === report.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        Review
                      </Button>
                      <Button
                        onClick={() => setResolveModal(report)}
                        disabled={actionLoading === report.id}
                        variant="primary"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Resolve
                      </Button>
                      <Button
                        onClick={() => handleDismiss(report)}
                        disabled={actionLoading === report.id}
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1 text-gray-500 hover:text-red-600"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Resolve Report</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Report #{resolveModal.id.slice(0, 8)} &mdash; {resolveModal.reason}
            </p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Action Taken
            </label>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Describe the action taken to resolve this report..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              rows={4}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={() => { setResolveModal(null); setActionTaken(''); }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={!actionTaken.trim() || actionLoading === resolveModal.id}
                variant="primary"
                className="flex items-center gap-2"
              >
                {actionLoading === resolveModal.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Resolve Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {strikeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Issue Strike</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action will penalize the user</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Target User ID
            </label>
            <input
              type="text"
              value={strikeTarget}
              onChange={(e) => setStrikeTarget(e.target.value)}
              placeholder="Enter user ID"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
            />
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Reason
            </label>
            <textarea
              value={strikeReason}
              onChange={(e) => setStrikeReason(e.target.value)}
              placeholder="Explain why this strike is being issued..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={() => { setStrikeModal(false); setStrikeTarget(''); setStrikeReason(''); }}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                onClick={handleIssueStrike}
                disabled={!strikeTarget.trim() || !strikeReason.trim() || strikeLoading}
                variant="danger"
                className="flex items-center gap-2"
              >
                {strikeLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Issue Strike
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
