import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Clock, ChevronRight, CheckCircle, AlertTriangle, Search, Filter, Loader2, Eye, MessageSquare } from 'lucide-react';
import {
  listStudentAnnouncements,
  getAnnouncementV2,
  markAnnouncementRead,
  acknowledgeAnnouncement,
  getAnnouncementReadStatus,
  createAnnouncementComment,
  listAnnouncementComments
} from '../../api/verification-announcements';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import Button from '../../components/ui/Button';

interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string;
  priority: string;
  category: string;
  is_pinned: boolean;
  requires_acknowledgment: boolean;
  attachment_count: number;
  attachments?: Array<{ id: string; filename: string; url: string; size: number }>;
  author_name: string;
  author_role: string;
  created_at: string;
  is_read?: boolean;
  is_acknowledged?: boolean;
}

interface AnnouncementComment {
  id: string;
  author_name: string;
  author_role: string;
  content: string;
  created_at: string;
}

type FilterTab = 'all' | 'unread' | 'urgent' | 'academic' | 'events' | 'fees';

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    case 'important': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    case 'reminder': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    default: return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  }
}

function getPriorityDot(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'urgent': return 'bg-red-500';
    case 'important': return 'bg-yellow-500';
    case 'reminder': return 'bg-blue-500';
    default: return 'bg-green-500';
  }
}

function getCategoryColor(category: string): string {
  switch (category?.toLowerCase()) {
    case 'academic': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'events': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
    case 'fees': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

export default function StudentAnnouncementsPage() {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [readStatus, setReadStatus] = useState<Record<string, boolean>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listStudentAnnouncements();
      setAnnouncements(data.announcements || data || []);
    } catch (err: any) {
      notify({ type: 'error', message: err?.message || 'Failed to load announcements' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    const fetchReadStatuses = async () => {
      try {
        const statuses = await Promise.all(
          announcements.map(async (a) => {
            const res = await getAnnouncementReadStatus(a.id);
            return { id: a.id, read: res?.is_read || false };
          })
        );
        const map: Record<string, boolean> = {};
        statuses.forEach((s) => { map[s.id] = s.read; });
        setReadStatus(map);
      } catch {
        // ignore
      }
    };
    if (announcements.length > 0) fetchReadStatuses();
  }, [announcements]);

  const filteredAnnouncements = announcements.filter((a) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.title?.toLowerCase().includes(q) && !a.content?.toLowerCase().includes(q) && !a.summary?.toLowerCase().includes(q)) {
        return false;
      }
    }
    switch (activeFilter) {
      case 'unread': return !readStatus[a.id];
      case 'urgent': return a.priority?.toLowerCase() === 'urgent';
      case 'academic': return a.category?.toLowerCase() === 'academic';
      case 'events': return a.category?.toLowerCase() === 'events';
      case 'fees': return a.category?.toLowerCase() === 'fees';
      default: return true;
    }
  });

  const sortedAnnouncements = [...filteredAnnouncements].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleOpenDetail = async (announcement: Announcement) => {
    setDetailLoading(true);
    setSelectedAnnouncement(announcement);
    setAcknowledged(false);
    setComments([]);
    setNewComment('');
    try {
      const full = await getAnnouncementV2(announcement.id);
      setSelectedAnnouncement(full);
      setAcknowledged(full.is_acknowledged || false);
      try {
        const readRes = await markAnnouncementRead(announcement.id);
        setReadStatus((prev) => ({ ...prev, [announcement.id]: true }));
      } catch {
        // ignore
      }
      try {
        const commRes = await listAnnouncementComments(announcement.id);
        setComments(commRes.comments || commRes || []);
      } catch {
        // ignore
      }
    } catch (err: any) {
      notify({ type: 'error', message: err?.message || 'Failed to load announcement' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAcknowledge = async (announcementId: string) => {
    setAcknowledging(true);
    try {
      await acknowledgeAnnouncement(announcementId);
      setAcknowledged(true);
      setSelectedAnnouncement((prev) => prev ? { ...prev, is_acknowledged: true } : null);
      notify({ type: 'success', message: 'Announcement acknowledged' });
    } catch (err: any) {
      notify({ type: 'error', message: err?.message || 'Failed to acknowledge' });
    } finally {
      setAcknowledging(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedAnnouncement) return;
    setSubmittingComment(true);
    try {
      const res = await createAnnouncementComment(selectedAnnouncement.id, { content: newComment.trim() });
      setComments((prev) => [...prev, res.comment || res]);
      setNewComment('');
      notify({ type: 'success', message: 'Comment added' });
    } catch (err: any) {
      notify({ type: 'error', message: err?.message || 'Failed to add comment' });
    } finally {
      setSubmittingComment(false);
    }
  };

  const truncate = (text: string, max: number) => {
    if (!text || text.length <= max) return text || '';
    return text.slice(0, max).trim() + '…';
  };

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'urgent', label: 'Urgent' },
    { key: 'academic', label: 'Academic' },
    { key: 'events', label: 'Events' },
    { key: 'fees', label: 'Fees' },
  ];

  if (selectedAnnouncement) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => setSelectedAnnouncement(null)}
            className="mb-6 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back to Announcements
          </Button>

          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedAnnouncement.priority)}`}>
                    {selectedAnnouncement.priority?.charAt(0).toUpperCase() + selectedAnnouncement.priority?.slice(1)}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(selectedAnnouncement.category)}`}>
                    {selectedAnnouncement.category?.charAt(0).toUpperCase() + selectedAnnouncement.category?.slice(1)}
                  </span>
                  {selectedAnnouncement.is_pinned && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      PINNED
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedAnnouncement.title}
                </h1>

                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-6">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {selectedAnnouncement.author_name}
                  </span>
                  {selectedAnnouncement.author_role && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {selectedAnnouncement.author_role}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {getRelativeTime(selectedAnnouncement.created_at)}
                  </span>
                </div>

                <div className="prose prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedAnnouncement.content}
                </div>

                {selectedAnnouncement.attachments && selectedAnnouncement.attachments.length > 0 && (
                  <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Attachments</h3>
                    <div className="space-y-2">
                      {selectedAnnouncement.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-gray-700 dark:text-gray-300"
                        >
                          <Eye className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate flex-1">{att.filename}</span>
                          {att.size && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {(att.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAnnouncement.requires_acknowledgment && (
                  <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={() => !acknowledged && handleAcknowledge(selectedAnnouncement.id)}
                          disabled={acknowledged || acknowledging}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          I have read and understood this announcement
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Your acknowledgment will be recorded
                        </p>
                      </div>
                      {acknowledging && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500 mt-0.5 flex-shrink-0" />
                      )}
                    </label>
                  </div>
                )}

                <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments ({comments.length})
                  </h3>

                  <div className="space-y-4 mb-6">
                    {comments.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">No comments yet</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {comment.author_name}
                            </span>
                            {comment.author_role && (
                              <span className="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                {comment.author_role}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {getRelativeTime(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                      placeholder="Write a comment..."
                      className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"
                    >
                      {submittingComment ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Send'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Megaphone className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm ml-10">Stay updated with department news</p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <Filter className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" />
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeFilter === f.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {f.label}
                {f.key === 'unread' && (
                  <span className="ml-1.5 text-xs opacity-75">
                    ({announcements.filter((a) => !readStatus[a.id]).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading announcements...</p>
          </div>
        ) : sortedAnnouncements.length === 0 ? (
          <div className="text-center py-20">
            <Megaphone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {searchQuery ? 'No announcements match your search' : 'No announcements available'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAnnouncements.map((announcement) => (
              <button
                key={announcement.id}
                onClick={() => handleOpenDetail(announcement)}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2.5 flex-shrink-0 ${getPriorityDot(announcement.priority)}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(announcement.priority)}`}>
                        {announcement.priority?.charAt(0).toUpperCase() + announcement.priority?.slice(1)}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(announcement.category)}`}>
                        {announcement.category?.charAt(0).toUpperCase() + announcement.category?.slice(1)}
                      </span>
                      {announcement.is_pinned && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                          PINNED
                        </span>
                      )}
                      {announcement.requires_acknowledgment && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                          <AlertTriangle className="w-3 h-3" />
                          Action Required
                        </span>
                      )}
                    </div>

                    <h3 className={`text-base font-semibold mb-1 ${
                      readStatus[announcement.id]
                        ? 'text-gray-600 dark:text-gray-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {announcement.title}
                    </h3>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                      {truncate(announcement.summary || announcement.content, 150)}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getRelativeTime(announcement.created_at)}
                        </span>
                        {announcement.attachment_count > 0 && (
                          <span>📎 {announcement.attachment_count} attachment{announcement.attachment_count !== 1 ? 's' : ''}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {readStatus[announcement.id] && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
