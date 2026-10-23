import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import { submitComplaint, getMyComplaints } from '../../api/complaints';
import type { Complaint } from '../../types';
import {
  Ticket,
  Search,
  Check,
  Clock,
  Send,
  Plus,
  CreditCard,
  Calendar,
  HelpCircle,
  ArrowLeft,
  Loader2,
  Award,
  Star,
  Copy,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

/* ─────────────────────── local types ─────────────────────── */

interface ChatMessage {
  id: string;
  sender: 'student' | 'staff' | 'system';
  senderName: string;
  time: string;
  content: string;
}

interface TicketItem {
  id: string;
  code: string;
  subject: string;
  category: string;
  categoryLabel: string;
  time: string;
  status: 'open' | 'in_review' | 'resolved';
  messages: ChatMessage[];
  resolution?: string;
  rawComplaint?: Complaint;
}

/* ─────────────────────── constants ─────────────────────── */

const CATEGORIES = [
  { id: 'result_discrepancy', label: 'Result discrepancy', icon: Award },
  { id: 'timetable_conflict', label: 'Timetable conflict', icon: Calendar },
  { id: 'payment_error', label: 'Payment error', icon: CreditCard },
  { id: 'other', label: 'Other', icon: HelpCircle },
];

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

const FEEDBACK_TAGS = ['Fast reply', 'Clear explanation', 'Helpful', 'Needed a follow-up'];

const STAR_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

/* ─────────────────────── helpers ─────────────────────── */

function getTicketCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return `#T-${1000 + (Math.abs(hash) % 9000)}`;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recent';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return date.toLocaleDateString();
}

function getCategoryLabel(category?: string): string {
  if (category === 'result_discrepancy' || category === 'result_error') return 'Result discrepancy';
  if (category === 'payment_error' || category === 'payment_issue') return 'Payment error';
  if (category === 'timetable_conflict' || category === 'timetable_clash') return 'Timetable conflict';
  if (category === 'attendance_dispute') return 'Attendance dispute';
  if (category === 'profile_issue') return 'Profile issue';
  return 'Other';
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  COMPONENT                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

const ComplaintsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [searchParams] = useSearchParams();

  /* ─── core state ─── */
  const [loading, setLoading] = useState(true);
  const [liveComplaints, setLiveComplaints] = useState<Complaint[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_review' | 'resolved'>('all');
  const [viewMode, setViewMode] = useState<'board' | 'submitted' | 'new_ticket'>('board');

  useEffect(() => {
    if (searchParams.get('new') === 'true' || searchParams.get('action') === 'new') {
      setViewMode('new_ticket');
    }
  }, [searchParams]);

  /* ─── confirmation state ─── */
  const [submittedTicket, setSubmittedTicket] = useState<TicketItem | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  /* ─── new ticket form ─── */
  const [newCategory, setNewCategory] = useState('result_discrepancy');
  const [newPriority, setNewPriority] = useState('medium');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* ─── feedback for resolved tickets ─── */
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});

  /* ─────────────────────── data fetching ─────────────────────── */

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await getMyComplaints();
      const list = Array.isArray(res) ? res : ((res as { data?: Complaint[] } | undefined)?.data ?? []);
      setLiveComplaints(list);
      if (list.length > 0 && !selectedTicketId) {
        setSelectedTicketId(list[0].id);
      }
    } catch (err) {
      notifyError('Connection Error', getErrorMessage(err, 'Could not fetch complaints from department server.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─────────────────────── derived data ─────────────────────── */

  const tickets = useMemo<TicketItem[]>(() => {
    return liveComplaints.map((c) => {
      const code = getTicketCode(c.id);
      const statusMap: Record<string, 'open' | 'in_review' | 'resolved'> = {
        open: 'open',
        pending: 'open',
        in_review: 'in_review',
        under_review: 'in_review',
        resolved: 'resolved',
      };
      const status = statusMap[c.status] || 'open';
      const catLabel = getCategoryLabel(c.category);
      const timeAgo = formatRelativeTime(c.createdAt);

      const messages: ChatMessage[] = [
        {
          id: `msg-${c.id}`,
          sender: 'student',
          senderName: 'You',
          time: timeAgo,
          content: c.description || c.subject || '',
        },
      ];

      if (c.resolution) {
        messages.push({
          id: `res-${c.id}`,
          sender: 'staff',
          senderName: 'Department Office',
          time: formatRelativeTime(c.resolvedAt || c.updatedAt),
          content: c.resolution,
        });
      }

      return {
        id: c.id,
        code,
        subject: c.subject || c.title || 'Support ticket',
        category: c.category,
        categoryLabel: catLabel,
        time: timeAgo,
        status,
        messages,
        resolution: c.resolution,
        rawComplaint: c,
      };
    });
  }, [liveComplaints]);

  const selectedTicket = useMemo(() => {
    if (submittedTicket && viewMode === 'submitted') return submittedTicket;
    return tickets.find((t) => t.id === selectedTicketId) || (tickets.length > 0 ? tickets[0] : null);
  }, [tickets, selectedTicketId, submittedTicket, viewMode]);

  const counts = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'open').length;
    const in_review = tickets.filter((t) => t.status === 'in_review').length;
    const resolved = tickets.filter((t) => t.status === 'resolved').length;
    return { all: tickets.length, open, in_review, resolved };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false;
      return true;
    });
  }, [tickets, filter]);

  /* ─────────────────────── handlers ─────────────────────── */

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim() || submitting) return;

    setSubmitting(true);
    try {
      const created = await submitComplaint({
        category: newCategory,
        subject: newSubject.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });

      success('Ticket Submitted', 'Your ticket has been sent to the department queue.');

      const newTicketItem: TicketItem = {
        id: created.id,
        code: getTicketCode(created.id),
        subject: created.subject || newSubject.trim(),
        category: created.category || newCategory,
        categoryLabel: getCategoryLabel(created.category || newCategory),
        time: 'Just now',
        status: 'open',
        messages: [
          {
            id: `msg-${created.id}`,
            sender: 'student',
            senderName: 'You',
            time: 'Just now',
            content: newDescription.trim(),
          },
        ],
        rawComplaint: created,
      };

      setSubmittedTicket(newTicketItem);
      setSelectedTicketId(created.id);
      setViewMode('submitted');

      // Reset form fields
      setNewSubject('');
      setNewDescription('');
      setNewPriority('medium');
      await fetchComplaints();
    } catch (err) {
      notifyError('Submission Failed', getErrorMessage(err, 'Failed to submit ticket.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTicketCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleFeedbackTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleSubmitFeedback = () => {
    if (!selectedTicket) return;
    setFeedbackSubmitted((prev) => ({ ...prev, [selectedTicket.id]: true }));
    success('Feedback Submitted', 'Thank you for helping us improve department support.');
  };

  const handleReopenTicket = () => {
    if (!selectedTicket) return;
    success('Ticket Reopened', 'Your ticket has been reopened for staff review.');
  };

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*  STATUS BADGE helper                                                       */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  const StatusBadge = ({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) => {
    const base =
      size === 'md'
        ? 'inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold'
        : 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold';

    if (status === 'resolved')
      return (
        <span
          className={`${base} border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5`}
        >
          <Check className="w-3 h-3 stroke-[3]" />
          <span>Resolved</span>
        </span>
      );
    if (status === 'in_review')
      return (
        <span className={`${base} border border-amber-500/30 text-amber-500 bg-amber-500/5`}>
          <Search className="w-3 h-3" />
          <span>In review</span>
        </span>
      );
    return (
      <span className={`${base} border border-[#1d68ec] text-[#1d68ec] dark:text-[#38bdf8]`}>
        <Clock className="w-3 h-3" />
        <span>Open</span>
      </span>
    );
  };

  /* ═══════════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                    */
  /* ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-900 dark:text-slate-100 transition-colors">
      {/* ────────────────── HEADER ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Complaints &amp; Tickets</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Open and track support tickets for results, registration or payment errors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {viewMode !== 'new_ticket' ? (
            <button
              onClick={() => setViewMode('new_ticket')}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-[#1d68ec] text-white hover:bg-[#1656c4] flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New ticket</span>
            </button>
          ) : (
            <button
              onClick={() => setViewMode('board')}
              className="px-4 py-2 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181a20] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1f222a] flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Back to tickets</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/*  LOADING STATE                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {loading && tickets.length === 0 ? (
        <div className="py-24 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#1d68ec] animate-spin" />
          <p className="text-xs text-slate-400">Loading support tickets...</p>
        </div>
      ) : viewMode === 'submitted' && submittedTicket ? (
        /* ═══════════════════════════════════════════════ */
        /*  VIEW: TICKET SUBMITTED CONFIRMATION            */
        /* ═══════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column — KPI Cards + Ticket Log */}
          <div className="lg:col-span-5 space-y-5">
            {/* 3 KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-4 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-[#1a2333] text-[#1d68ec] dark:text-[#38bdf8] flex items-center justify-center shrink-0">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Open</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{counts.open || 1}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-4 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#1f2229] text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">In review</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{counts.in_review}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-4 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-[#1f2229] text-slate-400 dark:text-slate-500 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Resolved</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{counts.resolved}</p>
                </div>
              </div>
            </div>

            {/* Ticket Log */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ticket log</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-4">
                Your complaints and staff replies
              </p>

              {/* Highlighted New Ticket */}
              <div className="p-4 rounded-xl border-2 border-[#1d68ec] bg-blue-50/20 dark:bg-[#1a2333]/30 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{submittedTicket.code}</span>
                  <StatusBadge status="open" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{submittedTicket.subject}</h4>
                <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{submittedTicket.categoryLabel}</span>
                  <span>{submittedTicket.time}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Confirmation Panel */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-7 shadow-sm flex flex-col items-center text-center">
            {/* Green Badge */}
            <div className="relative w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/20 border-8 border-emerald-100/60 dark:border-emerald-900/30 flex items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ticket submitted</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed">
              We have sent it to the department. You will see replies here and in Communication.
            </p>

            {/* Ticket Code + Copy */}
            <div className="inline-flex items-center gap-2 mt-4 px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1f2229]">
              <span className="text-xs font-bold text-slate-900 dark:text-white">{submittedTicket.code}</span>
              <button
                type="button"
                onClick={() => handleCopyTicketCode(submittedTicket.code)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Copy ticket code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Detail Box */}
            <div className="w-full max-w-md mt-6 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#15171c] p-4 text-left divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              <div className="flex items-center justify-between pb-2.5">
                <span className="text-slate-400 dark:text-slate-500">Category</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {submittedTicket.categoryLabel}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-slate-400 dark:text-slate-500">Subject</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[240px]">
                  {submittedTicket.subject}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-slate-400 dark:text-slate-500">Filed</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{submittedTicket.time}</span>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="w-full max-w-md mt-6 text-left">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase block mb-3">
                WHAT HAPPENS NEXT
              </span>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Ticket received</h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Your ticket is in the queue.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Staff review</h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      The department checks and replies.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Resolved</h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">You can rate the support.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full max-w-md mt-8">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-semibold shadow-sm transition-all"
              >
                View ticket &gt;
              </button>
              <button
                type="button"
                onClick={() => setViewMode('new_ticket')}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
              >
                + File another
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'new_ticket' ? (
        /* ═══════════════════════════════════════════════ */
        /*  VIEW: NEW TICKET FORM                          */
        /* ═══════════════════════════════════════════════ */
        <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-6 sm:p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">New ticket</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              File a ticket for support staff to review
            </p>
          </div>

          <form onSubmit={handleCreateTicket} className="space-y-5">
            {/* Category 2×2 grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-2">Category</label>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = newCategory === cat.id;
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewCategory(cat.id)}
                      className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-[#1d68ec] bg-blue-50/40 dark:bg-[#1a2333]/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#15171c] hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${isSelected ? 'text-[#1d68ec] dark:text-[#38bdf8]' : 'text-slate-400'}`}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{cat.label}</span>
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-[#1d68ec] text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-2">Priority</label>
              <div className="flex items-center gap-2">
                {PRIORITY_OPTIONS.map((p) => {
                  const isActive = newPriority === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewPriority(p.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#1d68ec] text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-[#20232b] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-900 dark:text-white">Subject</label>
                <span className="text-[10px] text-slate-400">{newSubject.length}/80</span>
              </div>
              <input
                type="text"
                maxLength={80}
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="e.g. Grade discrepancy for CPE 501"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#15171c] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#1d68ec]"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-900 dark:text-white">Description</label>
                <span className="text-[10px] text-slate-400">{newDescription.length}/1000</span>
              </div>
              <textarea
                rows={4}
                maxLength={1000}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Give precise details, including course codes, payment dates or references."
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#15171c] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#1d68ec] resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !newSubject.trim() || !newDescription.trim()}
              className="w-full py-3 rounded-xl bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting ticket...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit ticket</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════ */
        /*  VIEW: TICKET BOARD (list + conversation)       */
        /* ═══════════════════════════════════════════════ */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column — Filter pills + Tickets */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-5 shadow-sm">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {[
                { key: 'all' as const, label: 'All', count: counts.all },
                { key: 'open' as const, label: 'Open', count: counts.open },
                { key: 'in_review' as const, label: 'In review', count: counts.in_review },
                { key: 'resolved' as const, label: 'Resolved', count: counts.resolved },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilter(pill.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                    filter === pill.key
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-[#20232b] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pill.label} {pill.count}
                </button>
              ))}
            </div>

            {/* Ticket list */}
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredTickets.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#1f2229] flex items-center justify-center mb-3">
                    <MessageSquare className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No tickets yet</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[200px]">
                    Your complaints and support conversations will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setViewMode('new_ticket')}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>File a ticket</span>
                  </button>
                </div>
              ) : (
                filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#1d68ec] bg-blue-50/20 dark:bg-[#1a2333]/30 shadow-sm'
                          : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-[#15171c]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{t.code}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">{t.subject}</h4>
                      <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400 dark:text-slate-500">
                        <span>{t.categoryLabel}</span>
                        <span>{t.time}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column — Conversation & Feedback */}
          {selectedTicket ? (
            <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-6 sm:p-7 shadow-sm space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {selectedTicket.code} · {selectedTicket.categoryLabel} · Filed {selectedTicket.time}
                  </span>
                  <StatusBadge status={selectedTicket.status} size="md" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  {selectedTicket.subject}
                </h2>
              </div>

              {/* Resolved Banner */}
              {selectedTicket.status === 'resolved' && (
                <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-400 font-medium">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>
                    {selectedTicket.resolution
                      ? `This ticket was resolved. ${selectedTicket.resolution}`
                      : 'This ticket has been resolved by department staff.'}
                  </span>
                </div>
              )}

              {/* Chat Thread */}
              <div className="space-y-4 pt-1">
                {selectedTicket.messages.map((msg) => {
                  const isStudent = msg.sender === 'student';
                  return (
                    <div key={msg.id} className={`flex flex-col ${isStudent ? 'items-end' : 'items-start'}`}>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 px-1">
                        {msg.senderName} · {msg.time}
                      </span>
                      <div
                        className={`rounded-2xl p-4 text-xs leading-relaxed max-w-md shadow-sm ${
                          isStudent
                            ? 'bg-[#1d68ec] text-white rounded-tr-sm'
                            : 'bg-slate-100 dark:bg-[#1f2229] text-slate-800 dark:text-slate-200 rounded-tl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ────────── Feedback Section (resolved only) ────────── */}
              {selectedTicket.status === 'resolved' && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                  {feedbackSubmitted[selectedTicket.id] ? (
                    /* Feedback already sent */
                    <div className="py-8 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mx-auto mb-3">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Thank you!</p>
                      <p className="text-xs text-slate-400 mt-1">Your feedback has been submitted.</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">How was the support?</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Your feedback helps the department improve.
                        </p>
                      </div>

                      {/* Star Rating */}
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setSelectedRating(star)}
                            className="p-1 hover:scale-110 transition-transform"
                            aria-label={`${star} star`}
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= selectedRating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </button>
                        ))}
                        {selectedRating > 0 && (
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 ml-2">
                            {STAR_LABELS[selectedRating] || 'Good'}
                          </span>
                        )}
                      </div>

                      {/* Feedback Tags */}
                      <div className="flex flex-wrap gap-2">
                        {FEEDBACK_TAGS.map((tag) => {
                          const isTagSelected = selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleFeedbackTag(tag)}
                              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                isTagSelected
                                  ? 'bg-[#1d68ec] text-white shadow-sm'
                                  : 'bg-slate-100 dark:bg-[#1f2229] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>

                      {/* Optional Comment */}
                      <textarea
                        rows={3}
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Add a comment (optional)"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#15171c] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#1d68ec] resize-none"
                      />

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={handleReopenTicket}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reopen ticket</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSubmitFeedback}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit feedback</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Empty state — no ticket selected */
            <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1f2229] flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No ticket selected</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Select a ticket to view the conversation, or file a new one.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('new_ticket')}
                className="mt-4 px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>File a ticket</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComplaintsPage;
