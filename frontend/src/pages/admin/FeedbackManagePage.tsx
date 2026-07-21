import { useState, useEffect } from 'react';
import { MessageSquare, Star, CheckCircle, Clock, AlertCircle, Filter } from 'lucide-react';
import { listFeedback, updateFeedbackStatus, type Feedback } from '../../api/additional-features';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'planned', label: 'Planned' },
  { key: 'implemented', label: 'Implemented' },
  { key: 'declined', label: 'Declined' },
];

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  under_review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  planned: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  implemented: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  feature: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  general: 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  submitted: <Clock className="w-3.5 h-3.5" />,
  under_review: <AlertCircle className="w-3.5 h-3.5" />,
  planned: <Filter className="w-3.5 h-3.5" />,
  implemented: <CheckCircle className="w-3.5 h-3.5" />,
  declined: <AlertCircle className="w-3.5 h-3.5" />,
};

const FeedbackManagePage = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [responseMap, setResponseMap] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const data = await listFeedback();
      setFeedbacks(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filtered = activeTab === 'all' ? feedbacks : feedbacks.filter((f) => f.status === activeTab);

  const handleStatusUpdate = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await updateFeedbackStatus(id, { status, admin_response: responseMap[id] || undefined });
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status, admin_response: responseMap[id] || f.admin_response } : f)));
      setExpandedId(null);
    } catch {
      // silent
    } finally {
      setUpdatingId(null);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-surface-300 dark:text-surface-600'}`} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">User Feedback</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">Review and respond to user-submitted feedback</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-800 hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-surface-500">Loading feedback...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col items-center justify-center p-16 text-center">
            <MessageSquare className="w-10 h-10 text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-sm font-medium text-surface-500 dark:text-surface-400">No feedback submissions</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Feedback from users will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((fb) => (
              <div key={fb.id} className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${TYPE_STYLES[fb.feedback_type] || TYPE_STYLES.general}`}>
                          {fb.feedback_type}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[fb.status] || STATUS_STYLES.submitted}`}>
                          {STATUS_ICONS[fb.status]}
                          {fb.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{fb.title}</h3>
                      <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">{fb.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {fb.rating != null && renderStars(fb.rating)}
                      <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{fb.user_name || 'Anonymous'}</p>
                      <p className="text-xs text-surface-400 dark:text-surface-500">{fb.created_at ? new Date(fb.created_at).toLocaleDateString() : ''}</p>
                    </div>
                  </div>

                  {fb.admin_response && (
                    <div className="mt-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30">
                      <p className="text-xs font-medium text-primary-700 dark:text-primary-400 mb-1">Admin Response</p>
                      <p className="text-sm text-surface-700 dark:text-surface-300">{fb.admin_response}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-surface-100 dark:border-surface-800 px-5 py-3 flex items-center justify-between">
                  <button
                    onClick={() => setExpandedId(expandedId === fb.id ? null : fb.id)}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  >
                    {expandedId === fb.id ? 'Cancel' : 'Update Status'}
                  </button>
                </div>

                {expandedId === fb.id && (
                  <div className="border-t border-surface-100 dark:border-surface-800 p-5 space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Admin Response</label>
                      <textarea
                        value={responseMap[fb.id] || ''}
                        onChange={(e) => setResponseMap((prev) => ({ ...prev, [fb.id]: e.target.value }))}
                        placeholder="Write a response (optional)..."
                        className="w-full h-20 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_TABS.filter((t) => t.key !== 'all').map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => handleStatusUpdate(fb.id, tab.key)}
                          disabled={updatingId === fb.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                            fb.status === tab.key
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-primary-400 dark:hover:border-primary-600'
                          } disabled:opacity-50`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackManagePage;
