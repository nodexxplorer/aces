import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, XCircle, Send, Filter } from 'lucide-react';
import { createGradeAppeal, listMyAppeals, type GradeAppeal } from '../../api/additional-features';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  submitted: {
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    label: 'Submitted',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  lecturer_review: {
    color: 'text-yellow-700 dark:text-yellow-300',
    bg: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    label: 'Lecturer Review',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  hod_review: {
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    label: 'HOD Review',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  resolved: {
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    label: 'Resolved',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  rejected: {
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    label: 'Rejected',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
};

const FILTER_TABS = ['all', 'submitted', 'under_review', 'resolved', 'rejected'] as const;

type FilterTab = (typeof FILTER_TABS)[number];

const FILTER_LABELS: Record<FilterTab, string> = {
  all: 'All',
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

function matchesFilter(appeal: GradeAppeal, tab: FilterTab): boolean {
  if (tab === 'all') return true;
  if (tab === 'under_review') return appeal.status === 'lecturer_review' || appeal.status === 'hod_review';
  return appeal.status === tab;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

export default function GradeAppealsPage() {
  const [appeals, setAppeals] = useState<GradeAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showForm, setShowForm] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<GradeAppeal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formCourseId, setFormCourseId] = useState('');
  const [formSemesterId, setFormSemesterId] = useState('');
  const [formSessionId, setFormSessionId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formEvidence, setFormEvidence] = useState('');

  const fetchAppeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMyAppeals();
      const list = Array.isArray(res) ? res : ((res as { data?: GradeAppeal[] })?.data ?? []);
      setAppeals(list);
    } catch {
      setError('Failed to load grade appeals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, []);

  const filteredAppeals = appeals.filter((a) => matchesFilter(a, activeTab));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCourseId.trim() || !formSemesterId.trim() || !formSessionId.trim() || !formReason.trim()) return;
    setSubmitting(true);
    try {
      const evidenceUrls = formEvidence
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      await createGradeAppeal({
        course_id: formCourseId.trim(),
        semester_id: formSemesterId.trim(),
        session_id: formSessionId.trim(),
        reason: formReason.trim(),
        evidence: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      });
      setFormCourseId('');
      setFormSemesterId('');
      setFormSessionId('');
      setFormReason('');
      setFormEvidence('');
      setShowForm(false);
      fetchAppeals();
    } catch {
      setError('Failed to submit appeal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const closeDetail = () => setSelectedAppeal(null);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grade Appeals</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Submit and track appeals for grade corrections
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            New Appeal
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-1 shadow-sm w-fit">
          <Filter className="w-4 h-4 text-surface-400 mx-2" />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              {FILTER_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAppeals.length === 0 && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-12 text-center">
            <Clock className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-1">No Appeals Found</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {activeTab === 'all'
                ? "You haven't submitted any grade appeals yet."
                : `No appeals with status "${FILTER_LABELS[activeTab]}".`}
            </p>
          </div>
        )}

        {/* Appeal Cards */}
        {!loading && filteredAppeals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAppeals.map((appeal) => {
              const statusCfg = STATUS_CONFIG[appeal.status] ?? STATUS_CONFIG.submitted;
              return (
                <button
                  key={appeal.id}
                  onClick={() => setSelectedAppeal(appeal)}
                  className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-5 text-left hover:shadow-md transition-shadow w-full"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">
                        {appeal.course_code ?? 'N/A'}
                      </p>
                      <h3 className="text-base font-semibold text-surface-900 dark:text-white truncate mt-0.5">
                        {appeal.course_title ?? 'Grade Appeal'}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shrink-0 ${statusCfg.color} ${statusCfg.bg}`}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-surface-600 dark:text-surface-400 mb-3">
                    {truncate(appeal.reason, 120)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-surface-400 dark:text-surface-500">
                    {appeal.created_at && (
                      <span>Submitted {new Date(appeal.created_at).toLocaleDateString()}</span>
                    )}
                    {appeal.updated_at && appeal.updated_at !== appeal.created_at && (
                      <span>Updated {new Date(appeal.updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* New Appeal Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-surface-200 dark:border-surface-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">New Grade Appeal</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Course ID
                </label>
                <input
                  type="text"
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  placeholder="e.g. CPE511"
                  required
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Semester ID
                </label>
                <input
                  type="text"
                  value={formSemesterId}
                  onChange={(e) => setFormSemesterId(e.target.value)}
                  placeholder="e.g. 2025/2026-S1"
                  required
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Session ID
                </label>
                <input
                  type="text"
                  value={formSessionId}
                  onChange={(e) => setFormSessionId(e.target.value)}
                  placeholder="e.g. 2025/2026"
                  required
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Reason for Appeal
                </label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Explain why you believe your grade should be reviewed..."
                  required
                  rows={4}
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  Evidence URLs <span className="text-surface-400">(optional, comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={formEvidence}
                  onChange={(e) => setFormEvidence(e.target.value)}
                  placeholder="https://example.com/doc1, https://example.com/doc2"
                  className="w-full rounded-xl border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 px-3.5 py-2.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-surface-300 dark:border-surface-600 px-4 py-2.5 text-sm font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Appeal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeDetail} />
          <div className="relative bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {(() => {
              const statusCfg = STATUS_CONFIG[selectedAppeal.status] ?? STATUS_CONFIG.submitted;
              return (
                <>
                  <div className="p-6 border-b border-surface-200 dark:border-surface-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">
                          {selectedAppeal.course_code ?? 'N/A'}
                        </p>
                        <h2 className="text-xl font-bold text-surface-900 dark:text-white mt-0.5">
                          {selectedAppeal.course_title ?? 'Grade Appeal'}
                        </h2>
                      </div>
                      <button
                        onClick={closeDetail}
                        className="rounded-lg p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-surface-500 dark:text-surface-400">Status</span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCfg.color} ${statusCfg.bg}`}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* IDs */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1">Course ID</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{selectedAppeal.course_id ?? selectedAppeal.course_code ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1">Semester</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{selectedAppeal.semester_id ?? 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1">Session</p>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">{selectedAppeal.session_id ?? 'N/A'}</p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div>
                      <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1.5">Reason</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                        {selectedAppeal.reason}
                      </p>
                    </div>

                    {/* Evidence URLs */}
                    {selectedAppeal.evidence_urls && selectedAppeal.evidence_urls.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-surface-400 dark:text-surface-500 mb-1.5">Evidence</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedAppeal.evidence_urls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                            >
                              Evidence {idx + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lecturer Response */}
                    {selectedAppeal.lecturer_response && (
                      <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
                        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1.5">
                          Lecturer Response
                        </p>
                        <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                          {selectedAppeal.lecturer_response}
                        </p>
                      </div>
                    )}

                    {/* HOD Response */}
                    {selectedAppeal.hod_response && (
                      <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 mb-1.5">
                          HOD Response
                        </p>
                        <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap">
                          {selectedAppeal.hod_response}
                        </p>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="flex items-center gap-6 text-xs text-surface-400 dark:text-surface-500 pt-2 border-t border-surface-200 dark:border-surface-800">
                      {selectedAppeal.created_at && (
                        <span>Submitted {new Date(selectedAppeal.created_at).toLocaleString()}</span>
                      )}
                      {selectedAppeal.updated_at && (
                        <span>Updated {new Date(selectedAppeal.updated_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
