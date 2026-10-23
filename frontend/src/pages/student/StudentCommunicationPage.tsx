import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Megaphone,
  Pin,
  CheckCheck,
  Search,
  Check,
  Clock,
  ChevronRight,
  BookOpen,
  Calendar,
  CreditCard,
  User,
  MessageSquare,
  AlertTriangle,
  Bookmark,
  Send,
  Loader2,
  X,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import {
  listStudentAnnouncements,
  getAnnouncementV2,
  markAnnouncementRead,
  acknowledgeAnnouncement,
  getAnnouncementReadStatus,
  listAnnouncementComments,
  createAnnouncementComment,
  type AnnouncementV2,
  type AnnouncementComment,
} from '../../api/verification-announcements';
import {
  listClassNotices,
  listNoticeComments,
  createNoticeComment,
  type ClassNotice,
} from '../../api/additional-features';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import type { NotificationFull, NotificationPreferences } from '../../api/notifications';

// Relative time formatter
function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Group notifications into Today, Earlier This Week, Older
function groupNotifications(notifications: NotificationFull[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const today: NotificationFull[] = [];
  const earlierThisWeek: NotificationFull[] = [];
  const older: NotificationFull[] = [];

  notifications.forEach((item) => {
    const t = new Date(item.created_at).getTime();
    if (t >= startOfToday) {
      today.push(item);
    } else if (t >= startOfWeek) {
      earlierThisWeek.push(item);
    } else {
      older.push(item);
    }
  });

  return { today, earlierThisWeek, older };
}

// Notification Category Icon Helper
function getNotificationIcon(category?: string, type?: string) {
  const cat = (category || type || '').toLowerCase();
  if (cat.includes('due') || cat.includes('pay')) return CreditCard;
  if (cat.includes('result') || cat.includes('course') || cat.includes('academic')) return BookOpen;
  if (cat.includes('auth') || cat.includes('profile') || cat.includes('user')) return User;
  if (cat.includes('message') || cat.includes('ticket') || cat.includes('complaint')) return MessageSquare;
  if (cat.includes('announcement')) return Megaphone;
  return Bell;
}

export default function StudentCommunicationPage() {
  const { success, error: notifyError } = useNotification();
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState<'notifications' | 'announcements' | 'notices'>(
    initialTab === 'announcements' || initialTab === 'notices' ? initialTab : 'notifications',
  );

  // ==========================================
  // TAB 1: NOTIFICATIONS STATE & ACTIONS
  // ==========================================
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loadingNotifs = useNotificationStore((s) => s.loading);
  const preferences = useNotificationStore((s) => s.preferences);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const fetchPreferences = useNotificationStore((s) => s.fetchPreferences);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const updatePreferences = useNotificationStore((s) => s.updatePreferences);

  const [notifStatusFilter, setNotifStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<string>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [updatingPref, setUpdatingPref] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications(true);
    fetchUnreadCount();
    fetchPreferences();
  }, [fetchNotifications, fetchUnreadCount, fetchPreferences]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (notifStatusFilter === 'unread' && item.is_read) return false;
      if (notifStatusFilter === 'read' && !item.is_read) return false;
      if (notifCategoryFilter !== 'all') {
        const cat = (item.category || item.type || '').toLowerCase();
        if (!cat.includes(notifCategoryFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [notifications, notifStatusFilter, notifCategoryFilter]);

  const groupedNotifs = useMemo(() => groupNotifications(filteredNotifications), [filteredNotifications]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      await fetchUnreadCount();
      success('Success', 'All notifications marked as read.');
    } catch (err) {
      notifyError('Failed', getErrorMessage(err, 'Could not mark notifications as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = async (item: NotificationFull) => {
    if (!item.is_read) {
      await markAsRead(item.id);
      fetchUnreadCount();
    }
    if (item.action_url) {
      window.location.href = item.action_url;
    }
  };

  const handleTogglePref = async (key: keyof NotificationPreferences, currentVal: boolean) => {
    setUpdatingPref(String(key));
    try {
      await updatePreferences({ [key]: !currentVal });
      success('Preferences Updated', 'Your notification settings have been saved.');
    } catch (err) {
      notifyError('Update Failed', getErrorMessage(err, 'Could not update notification preference.'));
    } finally {
      setUpdatingPref(null);
    }
  };

  // ==========================================
  // TAB 2: ANNOUNCEMENTS STATE & ACTIONS
  // ==========================================
  const [announcements, setAnnouncements] = useState<AnnouncementV2[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [annSearch, setAnnSearch] = useState('');
  const [annFilter, setAnnFilter] = useState<'all' | 'unread' | 'urgent' | 'academic' | 'events' | 'fees'>('all');
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementV2 | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [annComments, setAnnComments] = useState<AnnouncementComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const fetchAnnouncementsData = useCallback(async () => {
    setLoadingAnnouncements(true);
    try {
      const data = await listStudentAnnouncements({ limit: 50 });
      setAnnouncements(data || []);
      // Fetch read statuses
      const statusResults = await Promise.all(
        (data || []).map(async (a) => {
          try {
            const res = await getAnnouncementReadStatus(a.id);
            return { id: a.id, read: res?.read || false, ack: res?.acknowledged || false };
          } catch {
            return { id: a.id, read: false, ack: false };
          }
        }),
      );
      const rMap: Record<string, boolean> = {};
      statusResults.forEach((s) => {
        rMap[s.id] = s.read;
      });
      setReadMap(rMap);
    } catch (err) {
      notifyError('Failed to load announcements', getErrorMessage(err, 'Check your connection.'));
    } finally {
      setLoadingAnnouncements(false);
    }
  }, [notifyError]);

  useEffect(() => {
    if (activeTab === 'announcements') {
      fetchAnnouncementsData();
    }
  }, [activeTab, fetchAnnouncementsData]);

  // Filter & Search Announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      if (annSearch) {
        const q = annSearch.toLowerCase();
        const inTitle = a.title?.toLowerCase().includes(q);
        const inContent = a.content?.toLowerCase().includes(q);
        const inSummary = a.summary?.toLowerCase().includes(q);
        if (!inTitle && !inContent && !inSummary) return false;
      }
      if (annFilter === 'unread' && readMap[a.id]) return false;
      if (annFilter === 'urgent' && a.priority?.toLowerCase() !== 'urgent') return false;
      if (annFilter === 'academic' && a.category?.toLowerCase() !== 'academic') return false;
      if (annFilter === 'events' && a.category?.toLowerCase() !== 'events') return false;
      if (annFilter === 'fees' && a.category?.toLowerCase() !== 'fees' && a.category?.toLowerCase() !== 'dues') {
        return false;
      }
      return true;
    });
  }, [announcements, annSearch, annFilter, readMap]);

  // Find Featured/Urgent announcement (or newest pinned)
  const featuredAnnouncement = useMemo(() => {
    return (
      filteredAnnouncements.find((a) => a.priority?.toLowerCase() === 'urgent' || a.is_pinned) ||
      (filteredAnnouncements.length > 0 ? filteredAnnouncements[0] : null)
    );
  }, [filteredAnnouncements]);

  const otherAnnouncements = useMemo(() => {
    if (!featuredAnnouncement) return filteredAnnouncements;
    return filteredAnnouncements.filter((a) => a.id !== featuredAnnouncement.id);
  }, [filteredAnnouncements, featuredAnnouncement]);

  const handleOpenAnnouncement = async (ann: AnnouncementV2) => {
    setSelectedAnnouncement(ann);
    setModalLoading(true);
    setAnnComments([]);
    setNewComment('');
    setIsAcknowledged(false);

    try {
      const full = await getAnnouncementV2(ann.id);
      setSelectedAnnouncement(full);
      // Mark as read in background
      markAnnouncementRead(ann.id)
        .then(() => setReadMap((prev) => ({ ...prev, [ann.id]: true })))
        .catch(() => {});
      // Fetch read/ack status
      getAnnouncementReadStatus(ann.id)
        .then((s) => setIsAcknowledged(s?.acknowledged || false))
        .catch(() => {});
      // Fetch comments
      const comments = await listAnnouncementComments(ann.id);
      setAnnComments(comments || []);
    } catch (err) {
      notifyError('Failed to load announcement details', getErrorMessage(err, ''));
    } finally {
      setModalLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setAcknowledging(true);
    try {
      await acknowledgeAnnouncement(id);
      setIsAcknowledged(true);
      success('Acknowledged', 'Your acknowledgment has been recorded.');
    } catch (err) {
      notifyError('Acknowledgment failed', getErrorMessage(err, ''));
    } finally {
      setAcknowledging(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedAnnouncement) return;
    setSubmittingComment(true);
    try {
      const created = await createAnnouncementComment(selectedAnnouncement.id, newComment.trim());
      setAnnComments((prev) => [...prev, created]);
      setNewComment('');
      success('Comment Posted', 'Your reply was published.');
    } catch (err) {
      notifyError('Failed to post comment', getErrorMessage(err, ''));
    } finally {
      setSubmittingComment(false);
    }
  };

  // ==========================================
  // TAB 3: NOTICE BOARD STATE & ACTIONS
  // ==========================================
  const [notices, setNotices] = useState<ClassNotice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'pinned' | 'exams' | 'department' | 'events'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedNotice, setSelectedNotice] = useState<ClassNotice | null>(null);
  const [noticeComments, setNoticeComments] = useState<
    { id: string; content: string; author_name: string; created_at: string }[]
  >([]);
  const [newNoticeComment, setNewNoticeComment] = useState('');
  const [submittingNoticeComment, setSubmittingNoticeComment] = useState(false);
  const [acknowledgedNotices, setAcknowledgedNotices] = useState<Record<string, boolean>>({});

  const fetchNoticesData = useCallback(async () => {
    setLoadingNotices(true);
    try {
      const res = await listClassNotices();
      setNotices(res || []);
    } catch (err) {
      notifyError('Failed to load notices', getErrorMessage(err, 'Please try again.'));
    } finally {
      setLoadingNotices(false);
    }
  }, [notifyError]);

  useEffect(() => {
    if (activeTab === 'notices') {
      fetchNoticesData();
    }
  }, [activeTab, fetchNoticesData]);

  // Filter and sort notices
  const filteredNotices = useMemo(() => {
    let list = notices.filter((n) => {
      if (noticeFilter === 'pinned' && !n.is_pinned) return false;
      if (noticeFilter === 'exams') {
        const titleLower = n.title.toLowerCase();
        if (!titleLower.includes('exam') && !titleLower.includes('assessment') && !titleLower.includes('test'))
          return false;
      }
      if (noticeFilter === 'department') {
        const titleLower = n.title.toLowerCase();
        if (!titleLower.includes('dept') && !titleLower.includes('department') && !titleLower.includes('meeting'))
          return false;
      }
      if (noticeFilter === 'events') {
        const titleLower = n.title.toLowerCase();
        if (!titleLower.includes('event') && !titleLower.includes('siwes') && !titleLower.includes('briefing'))
          return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });

    return list;
  }, [notices, noticeFilter, sortOrder]);

  const featuredNotice = useMemo(() => {
    return filteredNotices.find((n) => n.is_pinned) || (filteredNotices.length > 0 ? filteredNotices[0] : null);
  }, [filteredNotices]);

  const otherNotices = useMemo(() => {
    if (!featuredNotice) return filteredNotices;
    return filteredNotices.filter((n) => n.id !== featuredNotice.id);
  }, [filteredNotices, featuredNotice]);

  const handleOpenNotice = async (notice: ClassNotice) => {
    setSelectedNotice(notice);
    setNewNoticeComment('');
    try {
      const comments = await listNoticeComments(notice.id);
      setNoticeComments(comments || []);
    } catch {
      setNoticeComments([]);
    }
  };

  const handleAddNoticeComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeComment.trim() || !selectedNotice) return;
    setSubmittingNoticeComment(true);
    try {
      const created = await createNoticeComment(selectedNotice.id, newNoticeComment.trim());
      setNoticeComments((prev) => [...prev, created]);
      setNewNoticeComment('');
      success('Comment Posted', 'Your reply was published on the notice.');
    } catch (err) {
      notifyError('Failed to post comment', getErrorMessage(err, ''));
    } finally {
      setSubmittingNoticeComment(false);
    }
  };

  const handleAcknowledgeNotice = (noticeId: string) => {
    setAcknowledgedNotices((prev) => ({ ...prev, [noticeId]: true }));
    success('Notice Acknowledged', 'Your attendance acknowledgment has been saved.');
  };

  return (
    <div className="flex flex-col min-h-0 text-[var(--text)] space-y-5 sm:space-y-6 pb-12 w-full max-w-7xl mx-auto min-w-0">
      {/* ======================================================== */}
      {/* HEADER AREA */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text)]">
              Communication
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 sm:mt-1">
              Notifications, announcements and class notices in one place.
            </p>
          </div>
          <div className="sm:hidden shrink-0">
            <Link
              to="/notifications/settings"
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-[var(--text)] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Settings</span>
            </Link>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2.5">
          <Link
            to="/notifications/settings"
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1c1f28] text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TOP SEGMENTED PILL SWITCHER */}
      {/* ======================================================== */}
      <div className="w-full min-w-0 overflow-x-auto scrollbar-none pb-0.5">
        <div className="flex sm:inline-flex min-w-full sm:min-w-0 p-1 rounded-2xl sm:rounded-full border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#13151b] shadow-sm select-none gap-1">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'notifications'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="sm:hidden">Notifs</span>
            {unreadCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'notifications' ? 'bg-white text-[#1d68ec]' : 'bg-[#1d68ec] text-white'
                }`}
              >
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'announcements'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Announcements</span>
          </button>

          <button
            onClick={() => setActiveTab('notices')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === 'notices'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden sm:inline">Notice Board</span>
            <span className="sm:hidden">Notices</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: NOTIFICATIONS CONTENT (Matches media_1792263745715.png) */}
      {/* ======================================================== */}
      {activeTab === 'notifications' && (
        <div className="space-y-5 sm:space-y-6 w-full min-w-0">
          {/* Filter Pills & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 w-full min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={() => setNotifStatusFilter('all')}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  notifStatusFilter === 'all'
                    ? 'bg-[#1d68ec] text-white shadow-sm'
                    : 'bg-white dark:bg-[#15171e] border border-slate-200 dark:border-[#262833] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setNotifStatusFilter('unread')}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  notifStatusFilter === 'unread'
                    ? 'bg-[#1d68ec] text-white shadow-sm'
                    : 'bg-white dark:bg-[#15171e] border border-slate-200 dark:border-[#262833] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setNotifStatusFilter('read')}
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  notifStatusFilter === 'read'
                    ? 'bg-[#1d68ec] text-white shadow-sm'
                    : 'bg-white dark:bg-[#15171e] border border-slate-200 dark:border-[#262833] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                Read
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-xs font-semibold text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1d2029] transition-all disabled:opacity-50 shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#1d68ec]" />
                <span>{markingAll ? 'Marking...' : 'Mark all as read'}</span>
              </button>
            )}
          </div>

          {/* Category Chips Bar */}
          <div className="w-full min-w-0 max-w-full overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {[
                { id: 'all', label: 'All Categories' },
                { id: 'result', label: 'Results' },
                { id: 'due', label: 'Dues' },
                { id: 'message', label: 'Messages' },
                { id: 'auth', label: 'Auth' },
                { id: 'connect', label: 'Connect' },
                { id: 'alumni', label: 'Alumni' },
                { id: 'announcement', label: 'Announcements' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setNotifCategoryFilter(c.id)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                    notifCategoryFilter === c.id
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-semibold shadow-sm'
                      : 'bg-white dark:bg-[#14161c] border border-slate-200 dark:border-[#22252e] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2-Column Layout: Notification Feed (8 cols) + Sidebars (4 cols) */}
          <div className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* Left Column: Notification Feed */}
            <div className="w-full min-w-0 lg:col-span-8 space-y-5 sm:space-y-6">
              {loadingNotifs && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 text-[#1d68ec] animate-spin" />
                  <p className="text-xs text-[var(--text-muted)]">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] p-12 text-center shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#1d68ec] mx-auto flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text)]">No notifications</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                    You are all caught up! When updates or dues arrive, they will appear right here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* TODAY GROUP */}
                  {groupedNotifs.today.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                        Today
                      </h4>
                      <div className="space-y-2.5">
                        {groupedNotifs.today.map((item) => (
                          <NotificationCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* EARLIER THIS WEEK */}
                  {groupedNotifs.earlierThisWeek.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                        Earlier this week
                      </h4>
                      <div className="space-y-2.5">
                        {groupedNotifs.earlierThisWeek.map((item) => (
                          <NotificationCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OLDER */}
                  {groupedNotifs.older.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                        Older
                      </h4>
                      <div className="space-y-2.5">
                        {groupedNotifs.older.map((item) => (
                          <NotificationCard key={item.id} item={item} onClick={() => handleItemClick(item)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Sidebars (Inbox summary & Preferences) */}
            <div className="lg:col-span-4 space-y-5">
              {/* Inbox summary */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text)]">Inbox summary</h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-[#1d2028]">
                    <span className="text-[var(--text-muted)]">Unread</span>
                    <span className="font-bold text-[#1d68ec] text-sm">{unreadCount}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-[#1d2028]">
                    <span className="text-[var(--text-muted)]">Read</span>
                    <span className="font-bold text-[var(--text)] text-sm">
                      {notifications.filter((n) => n.is_read).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-[var(--text-muted)]">Needs action</span>
                    <span className="font-bold text-[var(--text)] text-sm">
                      {notifications.filter((n) => !n.is_read && Boolean(n.action_url)).length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[var(--text)]">Preferences</h3>
                <div className="space-y-3.5 text-xs">
                  {[
                    {
                      key: 'push_dues' as keyof NotificationPreferences,
                      label: 'Dues alerts',
                      checked: Boolean(preferences?.push_dues || preferences?.email_dues),
                    },
                    {
                      key: 'push_messages' as keyof NotificationPreferences,
                      label: 'Messages',
                      checked: Boolean(preferences?.push_messages || preferences?.email_messages),
                    },
                    {
                      key: 'push_system' as keyof NotificationPreferences,
                      label: 'Announcements',
                      checked: Boolean(preferences?.push_system || preferences?.in_app_enabled),
                    },
                    {
                      key: 'push_alumni' as keyof NotificationPreferences,
                      label: 'Alumni updates',
                      checked: Boolean(preferences?.push_alumni || preferences?.email_alumni),
                    },
                  ].map((pref) => (
                    <div key={pref.key} className="flex items-center justify-between">
                      <span className="text-[var(--text)] font-medium">{pref.label}</span>
                      <button
                        type="button"
                        disabled={updatingPref === pref.key}
                        onClick={() => handleTogglePref(pref.key, pref.checked)}
                        className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                          pref.checked ? 'bg-[#1d68ec]' : 'bg-slate-300 dark:bg-[#252833]'
                        }`}
                      >
                        <span
                          className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                            pref.checked ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ANNOUNCEMENTS CONTENT (Matches media_1792263744703.png) */}
      {/* ======================================================== */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={annSearch}
              onChange={(e) => setAnnSearch(e.target.value)}
              placeholder="Search announcements"
              className="w-full pl-11 pr-4 py-3 rounded-full border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#121419] text-xs sm:text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] shadow-sm focus:outline-none focus:border-[#1d68ec] focus:ring-1 focus:ring-[#1d68ec] transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'unread', label: `Unread(${announcements.filter((a) => !readMap[a.id]).length})` },
                { id: 'urgent', label: 'Urgent' },
                { id: 'academic', label: 'Academic' },
                { id: 'events', label: 'Events' },
                { id: 'fees', label: 'Fees' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setAnnFilter(f.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  annFilter === f.id
                    ? 'bg-[#1d68ec] text-white shadow-sm'
                    : 'bg-white dark:bg-[#15171e] border border-slate-200 dark:border-[#262833] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loadingAnnouncements ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-[#1d68ec] animate-spin" />
              <p className="text-xs text-[var(--text-muted)]">Loading announcements from department...</p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] p-12 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#1d68ec] mx-auto flex items-center justify-center mb-3">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--text)]">No announcements found</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                {annSearch
                  ? 'No announcements match your search query.'
                  : 'The department has not posted any announcements in this category yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Featured / Urgent Announcement Banner */}
              {featuredAnnouncement && (
                <div className="rounded-2xl border-l-4 border-l-red-500 border border-slate-200/80 dark:border-[#262833] bg-gradient-to-r from-red-500/5 via-slate-50/50 to-white dark:from-red-950/20 dark:via-[#13151b] dark:to-[#13151b] p-6 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-3xl">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Urgent</span>
                      </span>
                      <span className="text-[var(--text-muted)] text-[11px]">
                        {featuredAnnouncement.is_pinned ? 'Pinned · ' : ''}
                        Dept. Office · {formatTimeAgo(featuredAnnouncement.created_at)}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--text)]">
                      {featuredAnnouncement.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                      {featuredAnnouncement.summary || featuredAnnouncement.content}
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenAnnouncement(featuredAnnouncement)}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <span>Read announcement</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 3-Column Grid for other announcements */}
              {otherAnnouncements.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {otherAnnouncements.map((ann) => {
                    const cat = (ann.category || 'general').toLowerCase();
                    const Icon =
                      cat === 'academic'
                        ? BookOpen
                        : cat === 'events'
                          ? Calendar
                          : cat === 'fees' || cat === 'dues'
                            ? CreditCard
                            : Megaphone;

                    const pillColor =
                      cat === 'academic'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        : cat === 'events'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : cat === 'fees' || cat === 'dues'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

                    return (
                      <div
                        key={ann.id}
                        onClick={() => handleOpenAnnouncement(ann)}
                        className="rounded-2xl border border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] p-5 shadow-sm hover:border-[#1d68ec]/50 dark:hover:border-[#1d68ec]/50 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${pillColor}`}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="capitalize">{ann.category || 'General'}</span>
                            </span>
                            <Bookmark className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors" />
                          </div>

                          <h4 className="text-sm sm:text-base font-bold text-[var(--text)] mt-3.5 line-clamp-2 group-hover:text-[#1d68ec] transition-colors">
                            {ann.title}
                          </h4>
                          <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-3 leading-relaxed">
                            {ann.summary || ann.content}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-[#1d2028] text-xs">
                          <span className="text-[var(--text-muted)] text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Dept. Office · {formatTimeAgo(ann.created_at)}</span>
                          </span>
                          <span className="text-[#1d68ec] font-semibold text-xs group-hover:underline">Read more</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: NOTICE BOARD CONTENT (Matches media_1792263744667.png) */}
      {/* ======================================================== */}
      {activeTab === 'notices' && (
        <div className="space-y-6">
          {/* Filter Pills & Sort Order */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'pinned', label: 'Pinned' },
                  { id: 'exams', label: 'Exams' },
                  { id: 'department', label: 'Department' },
                  { id: 'events', label: 'Events' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setNoticeFilter(f.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    noticeFilter === f.id
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'bg-white dark:bg-[#15171e] border border-slate-200 dark:border-[#262833] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 self-end sm:self-auto">
              <span>Sort:</span>
              <button
                onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                className="font-semibold text-[var(--text)] hover:text-[#1d68ec] transition-colors"
              >
                {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
              </button>
            </div>
          </div>

          {loadingNotices ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-[#1d68ec] animate-spin" />
              <p className="text-xs text-[var(--text-muted)]">Loading class notices...</p>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] p-12 text-center shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#1d68ec] mx-auto flex items-center justify-center mb-3">
                <Pin className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--text)]">No notices posted</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
                There are no class notices in this category right now.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Featured Notice Card (e.g. pinned or urgent notice with blue border) */}
              {featuredNotice && (
                <div className="rounded-2xl border-2 border-[#1d68ec]/80 dark:border-[#1d68ec]/70 bg-white dark:bg-[#121419] p-6 sm:p-7 shadow-sm transition-all space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Urgent</span>
                    </span>
                    <Pin className="w-4 h-4 text-[#1d68ec]" />
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-[var(--text)]">{featuredNotice.title}</h3>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-2 leading-relaxed whitespace-pre-wrap">
                      {featuredNotice.content}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-100 dark:border-[#1e212a] gap-3">
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {featuredNotice.author_name} · {formatTimeAgo(featuredNotice.created_at)}
                      </span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenNotice(featuredNotice)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-xs font-semibold text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1c1f28] transition-all flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span>Discussion ({featuredNotice.comment_count || 0})</span>
                      </button>

                      <button
                        onClick={() => handleAcknowledgeNotice(featuredNotice.id)}
                        disabled={acknowledgedNotices[featuredNotice.id]}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all ${
                          acknowledgedNotices[featuredNotice.id]
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#1d68ec] hover:bg-[#1554c2] text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{acknowledgedNotices[featuredNotice.id] ? 'Acknowledged' : 'Acknowledge'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid of Other Notices */}
              {otherNotices.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {otherNotices.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] p-5 shadow-sm hover:border-[#1d68ec]/50 dark:hover:border-[#1d68ec]/50 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            <User className="w-3 h-3" />
                            <span>Department</span>
                          </span>
                          <Pin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        </div>

                        <h4 className="text-sm sm:text-base font-bold text-[var(--text)] mt-3.5 line-clamp-2">
                          {n.title}
                        </h4>
                        <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-3 leading-relaxed">
                          {n.content}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-[#1d2028] text-xs">
                        <span className="text-[var(--text-muted)] text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {n.author_name} · {formatTimeAgo(n.created_at)}
                          </span>
                        </span>

                        <button
                          onClick={() => handleOpenNotice(n)}
                          className="text-[#1d68ec] hover:underline font-semibold text-xs flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{n.comment_count || 0}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ANNOUNCEMENT DETAIL & COMMENTS MODAL */}
      {/* ======================================================== */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#12141a] rounded-3xl border border-slate-200 dark:border-[#262833] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-[#22252e] flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 capitalize">
                    {selectedAnnouncement.category || 'General'}
                  </span>
                  {selectedAnnouncement.priority?.toLowerCase() === 'urgent' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      Urgent
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[var(--text)]">{selectedAnnouncement.title}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Posted by {selectedAnnouncement.author_name || 'Dept. Office'} ·{' '}
                  {formatTimeAgo(selectedAnnouncement.created_at)}
                </p>
              </div>

              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1f222c] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed text-[var(--text)]">
              {modalLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 text-[#1d68ec] animate-spin" />
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{selectedAnnouncement.content}</p>

                  {/* Acknowledgment action if required */}
                  {selectedAnnouncement.requires_acknowledgment && (
                    <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-950/60 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs">
                        <ShieldCheck className="w-4 h-4 text-[#1d68ec]" />
                        <span>This announcement requires confirmation of receipt.</span>
                      </div>
                      <button
                        onClick={() => handleAcknowledge(selectedAnnouncement.id)}
                        disabled={isAcknowledged || acknowledging}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all ${
                          isAcknowledged ? 'bg-emerald-600 text-white' : 'bg-[#1d68ec] hover:bg-[#1554c2] text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {isAcknowledged ? 'Acknowledged' : acknowledging ? 'Saving...' : 'Acknowledge receipt'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Comments Section */}
                  <div className="pt-4 border-t border-slate-100 dark:border-[#22252e] space-y-4">
                    <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#1d68ec]" />
                      <span>Discussion ({annComments.length})</span>
                    </h4>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {annComments.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] italic">
                          No comments yet. Be the first to reply.
                        </p>
                      ) : (
                        annComments.map((c) => (
                          <div
                            key={c.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-[#15171e] border border-slate-100 dark:border-[#22252e] text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[var(--text)]">{c.author_name}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {formatTimeAgo(c.created_at)}
                              </span>
                            </div>
                            <p className="text-[var(--text-muted)]">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add comment input */}
                    <form onSubmit={handleAddComment} className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a response..."
                        className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-xs text-[var(--text)] focus:outline-none focus:border-[#1d68ec]"
                      />
                      <button
                        type="submit"
                        disabled={submittingComment || !newComment.trim()}
                        className="px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Reply</span>
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* NOTICE COMMENTS MODAL */}
      {/* ======================================================== */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#12141a] rounded-3xl border border-slate-200 dark:border-[#262833] max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-100 dark:border-[#22252e] flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">{selectedNotice.title}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {selectedNotice.author_name} · {formatTimeAgo(selectedNotice.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedNotice(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1f222c] text-[var(--text-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {selectedNotice.content}
              </p>

              <div className="pt-3 border-t border-slate-100 dark:border-[#22252e] space-y-3">
                <h4 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#1d68ec]" />
                  <span>Comments ({noticeComments.length})</span>
                </h4>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {noticeComments.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic">No comments on this notice yet.</p>
                  ) : (
                    noticeComments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#15171e] border border-slate-100 dark:border-[#22252e] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--text)]">{c.author_name}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{formatTimeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-[var(--text-muted)]">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddNoticeComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newNoticeComment}
                    onChange={(e) => setNewNoticeComment(e.target.value)}
                    placeholder="Comment on this notice..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#15171e] text-xs text-[var(--text)] focus:outline-none focus:border-[#1d68ec]"
                  />
                  <button
                    type="submit"
                    disabled={submittingNoticeComment || !newNoticeComment.trim()}
                    className="px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent for Notification Item Card
function NotificationCard({ item, onClick }: { item: NotificationFull; onClick: () => void }) {
  const Icon = getNotificationIcon(item.category, item.type);

  return (
    <div
      onClick={onClick}
      className={`w-full min-w-0 p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start gap-2.5 sm:gap-3.5 cursor-pointer group ${
        item.is_read
          ? 'border-slate-200/80 dark:border-[#22252e] bg-white dark:bg-[#121419] opacity-85 hover:opacity-100'
          : 'border-slate-300 dark:border-[#2a2d39] bg-white dark:bg-[#14161c] shadow-sm hover:border-[#1d68ec]/60'
      }`}
    >
      {/* Unread indicator dot */}
      <div className="pt-2 shrink-0">
        <div className={`w-2 h-2 rounded-full transition-colors ${item.is_read ? 'bg-transparent' : 'bg-[#1d68ec]'}`} />
      </div>

      {/* Category Icon */}
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-[#1b1e26] border border-slate-200 dark:border-[#262934] text-[#1d68ec] dark:text-[#38bdf8] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1 sm:pr-2">
        <h4 className="text-xs sm:text-sm font-bold text-[var(--text)] group-hover:text-[#1d68ec] transition-colors truncate">
          {item.title}
        </h4>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">{item.message}</p>
      </div>

      {/* Right time & action */}
      <div className="flex flex-col items-end gap-1.5 sm:gap-2 shrink-0">
        <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] whitespace-nowrap">
          {formatTimeAgo(item.created_at)}
        </span>
        {item.action_url && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#1d68ec] hover:bg-[#1554c2] text-white text-[11px] sm:text-xs font-semibold transition-all shadow-sm whitespace-nowrap"
          >
            {item.action_label || 'View'}
          </button>
        )}
      </div>
    </div>
  );
}
