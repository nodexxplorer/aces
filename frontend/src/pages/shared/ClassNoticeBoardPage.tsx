import { useState, useEffect } from 'react';
import { Megaphone, Pin, MessageSquare, Send, Plus, Clock } from 'lucide-react';
import { listClassNotices, createNoticeComment, listNoticeComments, type ClassNotice } from '../../api/additional-features';
import { useAuthStore } from '../../stores/authStore';

export default function ClassNoticeBoardPage() {
  const { user } = useAuthStore();
  const [notices, setNotices] = useState<ClassNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, { id: string; content: string; author_name: string; created_at: string }[]>>({});
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    setLoading(true);
    listClassNotices()
      .then(setNotices)
      .catch(() => setError('Failed to load class notices.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!expandedNoticeId) return;
    setLoadingComments(true);
    listNoticeComments(expandedNoticeId)
      .then((comments) => setCommentsMap((prev) => ({ ...prev, [expandedNoticeId]: comments })))
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [expandedNoticeId]);

  const handleToggle = (noticeId: string) => {
    setExpandedNoticeId((prev) => (prev === noticeId ? null : noticeId));
    setCommentText('');
  };

  const handleSubmitComment = async (noticeId: string) => {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    try {
      const newComment = await createNoticeComment(noticeId, commentText.trim());
      setCommentsMap((prev) => ({
        ...prev,
        [noticeId]: [...(prev[noticeId] || []), newComment],
      }));
      setCommentText('');
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const pinnedNotices = notices.filter((n) => n.is_pinned);
  const regularNotices = notices.filter((n) => !n.is_pinned);

  const renderNotice = (notice: ClassNotice) => {
    const isExpanded = expandedNoticeId === notice.id;
    const comments = commentsMap[notice.id] || [];

    return (
      <div
        key={notice.id}
        className={`bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden transition-all ${
          notice.is_pinned ? 'border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' : ''
        }`}
      >
        <button
          onClick={() => handleToggle(notice.id)}
          className="w-full text-left p-5 focus:outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-surface-900 dark:text-white truncate">
                  {notice.title}
                </h3>
                {notice.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full">
                    <Pin className="w-3 h-3" />
                    Pinned
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-surface-600 dark:text-surface-400 line-clamp-2">
                {notice.content}
              </p>
            </div>
            <MessageSquare className="w-4 h-4 text-surface-400 shrink-0 mt-1" />
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
            <span className="font-medium text-surface-600 dark:text-surface-300">{notice.author_name}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(notice.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {notice.comment_count || 0}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-surface-100 dark:border-surface-800 px-5 pb-5">
            <div className="pt-4">
              <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                {notice.content}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <h4 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments
              </h4>

              {loadingComments ? (
                <p className="text-xs text-surface-400 py-2">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-surface-400 py-2">No comments yet. Be the first to comment.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((c, i) => (
                    <div key={i} className="bg-surface-50 dark:bg-surface-800 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-surface-900 dark:text-white">{c.author_name}</span>
                        <span className="text-[10px] text-surface-400">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {user && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(notice.id);
                      }
                    }}
                    placeholder="Write a comment..."
                    className="flex-1 bg-surface-50 dark:bg-surface-800 rounded-full px-4 py-2 text-sm text-surface-900 dark:text-white placeholder-surface-400 outline-none focus:ring-2 focus:ring-primary-500/40"
                  />
                  <button
                    onClick={() => handleSubmitComment(notice.id)}
                    disabled={!commentText.trim() || submitting}
                    className="p-2 rounded-full bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-2xl bg-primary-500/10">
            <Megaphone className="w-6 h-6 text-primary-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Class Notice Board</h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">Stay updated with class announcements</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-8 text-center">
            <Megaphone className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <p className="text-sm text-surface-500 dark:text-surface-400">No notices posted yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pinnedNotices.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Pin className="w-4 h-4 text-yellow-500" />
                  <h2 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
                    Pinned
                  </h2>
                </div>
                <div className="space-y-4">
                  {pinnedNotices.map(renderNotice)}
                </div>
              </section>
            )}

            {regularNotices.length > 0 && (
              <section>
                {pinnedNotices.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Megaphone className="w-4 h-4 text-surface-400" />
                    <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                      Recent
                    </h2>
                  </div>
                )}
                <div className="space-y-4">
                  {regularNotices.map(renderNotice)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
