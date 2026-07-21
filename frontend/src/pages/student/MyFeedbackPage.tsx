import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Star, Send } from 'lucide-react';
import { createFeedback, listMyFeedback, type Feedback } from '../../api/additional-features';

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

const MyFeedbackPage = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState('feature');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const data = await listMyFeedback();
      setFeedbacks(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitting(true);
    try {
      await createFeedback({ feedback_type: type, title, description, rating: rating || undefined });
      setTitle('');
      setDescription('');
      setRating(0);
      setType('feature');
      setShowForm(false);
      fetchFeedbacks();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (count: number, interactive = false) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type={interactive ? 'button' : undefined}
          onClick={interactive ? () => setRating(s) : undefined}
          onMouseEnter={interactive ? () => setHoveredStar(s) : undefined}
          onMouseLeave={interactive ? () => setHoveredStar(0) : undefined}
          className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}
          disabled={!interactive}
        >
          <Star
            className={`w-4 h-4 ${
              s <= (interactive ? hoveredStar || rating : count)
                ? 'fill-amber-400 text-amber-400'
                : 'text-surface-300 dark:text-surface-600'
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-white">My Feedback</h1>
              <p className="text-sm text-surface-500 dark:text-surface-400">Submit and track your feedback submissions</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Submit Feedback
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-4">New Feedback</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Type</label>
                <div className="flex gap-2">
                  {[
                    { value: 'bug', label: 'Bug Report' },
                    { value: 'feature', label: 'Feature Request' },
                    { value: 'general', label: 'General' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                        type === opt.value
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white dark:bg-surface-950 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-primary-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Brief summary of your feedback"
                  className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="Provide detailed information about your feedback..."
                  className="w-full h-28 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-950 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Rating (optional)</label>
                <div className="flex items-center gap-2">
                  {renderStars(rating, true)}
                  {rating > 0 && (
                    <span className="text-xs text-surface-400 dark:text-surface-500 ml-1">{rating}/5</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title || !description}
                  className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-surface-500">Loading your feedback...</span>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col items-center justify-center p-16 text-center">
            <MessageSquare className="w-10 h-10 text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-sm font-medium text-surface-500 dark:text-surface-400">No feedback submitted yet</p>
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">Click "Submit Feedback" to share your thoughts with the team</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <div key={fb.id} className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${TYPE_STYLES[fb.feedback_type] || TYPE_STYLES.general}`}>
                        {fb.feedback_type}
                      </span>
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[fb.status] || STATUS_STYLES.submitted}`}>
                        {fb.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{fb.title}</h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{fb.description}</p>
                    {fb.admin_response && (
                      <div className="mt-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30">
                        <p className="text-xs font-medium text-primary-700 dark:text-primary-400 mb-1">Admin Response</p>
                        <p className="text-sm text-surface-700 dark:text-surface-300">{fb.admin_response}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {fb.rating != null && renderStars(fb.rating)}
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                      {fb.created_at ? new Date(fb.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyFeedbackPage;
