import React, { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../../hooks/useNotification';
import {
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  Pin,
  CheckCircle2,
  AlertTriangle,
  Send,
  Check,
  Users,
  CreditCard,
  Smile,
  FileText,
  Volume2,
  Bold,
  Italic,
  Underline,
  Link2,
  Paperclip,
  ChevronDown,
} from 'lucide-react';
import {
  createAnnouncementV2,
  listAdminAnnouncements,
  updateAnnouncementV2,
  deleteAnnouncementV2,
  type AnnouncementV2,
} from '../../api/verification-announcements';
import { getStudents } from '../../api/users';
import { getErrorMessage } from '../../utils/errors';

interface TemplateOption {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  defaultTitle: string;
  defaultContent: string;
  defaultSummary: string;
  defaultPriority: 'General' | 'Important' | 'Urgent';
  defaultCategory: 'Academic' | 'Fees' | 'Events' | 'General';
  requiresAck: boolean;
  pinned: boolean;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'emergency',
    title: 'Emergency alert',
    subtitle: 'Urgent notice to everyone',
    icon: AlertTriangle,
    iconColor: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    defaultTitle: 'Emergency Notice: Urgent Campus Update',
    defaultContent:
      'All students are advised to take note of the urgent administrative announcement regarding campus activities and safety guidelines.',
    defaultSummary: 'Urgent notice regarding campus safety and operational adjustments.',
    defaultPriority: 'Urgent',
    defaultCategory: 'General',
    requiresAck: true,
    pinned: true,
  },
  {
    id: 'event',
    title: 'Event invite',
    subtitle: 'Invite students to an event',
    icon: Calendar,
    iconColor: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    defaultTitle: 'Departmental Symposium & Innovation Day',
    defaultContent:
      'You are cordially invited to attend the Department Innovation Symposium scheduled for this semester. Join faculty and industry mentors for keynote sessions.',
    defaultSummary: 'Invitation to the annual departmental symposium and keynote lectures.',
    defaultPriority: 'General',
    defaultCategory: 'Events',
    requiresAck: false,
    pinned: false,
  },
  {
    id: 'exam',
    title: 'Exam notice',
    subtitle: 'Dates, venue and rules',
    icon: Edit3,
    iconColor: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
    defaultTitle: 'Semester Examination Timetable & Guidelines',
    defaultContent:
      'The examination timetable for the upcoming semester is now published. Please verify your exam venues and arrive with your valid student ID card and course registration forms.',
    defaultSummary: 'Dates, venue allocations, and rules for the semester examinations.',
    defaultPriority: 'Important',
    defaultCategory: 'Academic',
    requiresAck: true,
    pinned: true,
  },
  {
    id: 'fee',
    title: 'Fee reminder',
    subtitle: 'Remind students about dues',
    icon: CreditCard,
    iconColor: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
    defaultTitle: 'Fee Reminder: Departmental Dues Close Soon',
    defaultContent:
      'This is a gentle reminder that departmental dues and registration fees must be settled prior to the course form signing deadline. Defaulters will be restricted from final approval.',
    defaultSummary: 'Remind students about the payment deadline for departmental dues.',
    defaultPriority: 'Important',
    defaultCategory: 'Fees',
    requiresAck: false,
    pinned: false,
  },
  {
    id: 'welcome',
    title: 'Welcome back',
    subtitle: 'Start of a new session',
    icon: Smile,
    iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    defaultTitle: 'Welcome Back to the New Academic Session',
    defaultContent:
      'Welcome back to all returning students and freshmen! We wish you a productive and rewarding session. Academic advisers are available for course registration guidance.',
    defaultSummary: 'Start of a new session announcements and orientation schedule.',
    defaultPriority: 'General',
    defaultCategory: 'General',
    requiresAck: false,
    pinned: false,
  },
];

type PriorityType = 'General' | 'Important' | 'Urgent';
type CategoryType = 'Academic' | 'Fees' | 'Events' | 'General';
type DeliveryMode = 'draft' | 'publish' | 'schedule';

export const AnnouncementsManagePage: React.FC = () => {
  const { success, error: notifyError } = useNotification();

  // Mode: list vs create
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Real data state
  const [announcements, setAnnouncements] = useState<AnnouncementV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(214);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState<PriorityType>('Important');
  const [category, setCategory] = useState<CategoryType>('Academic');
  const [selectedAudience, setSelectedAudience] = useState<string>('All students');
  const [isPinned, setIsPinned] = useState(false);
  const [requiresAck, setRequiresAck] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('schedule');
  const [scheduleDate, setScheduleDate] = useState('2026-09-07');
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [notifyChannels, setNotifyChannels] = useState<{ inApp: boolean; email: boolean; push: boolean }>({
    inApp: true,
    email: false,
    push: false,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch real announcements & students count
  const fetchData = async () => {
    setLoading(true);
    try {
      const [annRes, studentList] = await Promise.allSettled([listAdminAnnouncements(), getStudents({ perPage: 100 })]);

      if (annRes.status === 'fulfilled') {
        setAnnouncements(annRes.value || []);
      }
      if (studentList.status === 'fulfilled' && Array.isArray(studentList.value)) {
        setTotalStudentsCount(studentList.value.length || 214);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = announcements.length;
    const published = announcements.filter((a) => a.status === 'published').length;
    const scheduled = announcements.filter((a) => a.status === 'scheduled').length;
    const drafts = announcements.filter((a) => a.status === 'draft').length;
    const archived = announcements.filter((a) => a.status === 'archived').length;
    return { total, published, scheduled, drafts, archived };
  }, [announcements]);

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && a.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      if (categoryFilter !== 'all' && a.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      return true;
    });
  }, [announcements, statusFilter, priorityFilter, categoryFilter]);

  // Apply template
  const handleUseTemplate = (tpl: TemplateOption) => {
    setTitle(tpl.defaultTitle);
    setContent(tpl.defaultContent);
    setSummary(tpl.defaultSummary);
    setPriority(tpl.defaultPriority);
    setCategory(tpl.defaultCategory);
    setRequiresAck(tpl.requiresAck);
    setIsPinned(tpl.pinned);
    setTemplateDropdownOpen(false);
    setIsCreating(true);
  };

  // Reset form
  const handleResetForm = () => {
    setTitle('');
    setContent('');
    setSummary('');
    setPriority('Important');
    setCategory('Academic');
    setSelectedAudience('All students');
    setIsPinned(false);
    setRequiresAck(false);
    setDeliveryMode('publish');
    setEditingId(null);
    setIsCreating(false);
  };

  // Submit announcement
  const handleSubmit = async (overrideStatus?: 'draft' | 'published' | 'scheduled') => {
    if (!title.trim()) {
      notifyError('Missing Title', 'Please enter an announcement title.');
      return;
    }
    if (!content.trim()) {
      notifyError('Missing Content', 'Please provide announcement content.');
      return;
    }

    setSubmitting(true);
    const targetStatus =
      overrideStatus || (deliveryMode === 'draft' ? 'draft' : deliveryMode === 'schedule' ? 'scheduled' : 'published');

    let scheduledFor: string | undefined;
    if (targetStatus === 'scheduled') {
      scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    try {
      if (editingId) {
        await updateAnnouncementV2(editingId, {
          title,
          content,
          summary: summary || undefined,
          priority,
          category,
          is_pinned: isPinned,
          requires_acknowledgment: requiresAck,
          status: targetStatus,
          target_audience: [selectedAudience],
        });
        success('Announcement Updated', 'Changes have been saved successfully.');
      } else {
        await createAnnouncementV2({
          title,
          content,
          summary: summary || undefined,
          priority,
          category,
          is_pinned: isPinned,
          requires_acknowledgment: requiresAck,
          status: targetStatus,
          scheduled_for: scheduledFor,
          target_audience: [selectedAudience],
        });
        success(
          targetStatus === 'published'
            ? 'Announcement Published'
            : targetStatus === 'scheduled'
              ? 'Announcement Scheduled'
              : 'Draft Saved',
          'Your announcement has been saved.',
        );
      }
      handleResetForm();
      fetchData();
    } catch (err) {
      notifyError('Operation Failed', getErrorMessage(err, 'Failed to save announcement.'));
    } finally {
      setSubmitting(false);
    }
  };

  const audienceOptions = ['All students', '100 Level', '200 Level', '300 Level', '400 Level', '500 Level', 'Alumni'];

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* ─── CREATE / EDIT ANNOUNCEMENT VIEW ─── */}
        {isCreating ? (
          <div className="space-y-6">
            {/* Header & Breadcrumb */}
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <span>Announcements</span>
                <span>&gt;</span>
                <span className="text-slate-900 dark:text-white">{editingId ? 'Edit' : 'New'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Create announcement
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column (2 Cols): Form inputs */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm space-y-5">
                  {/* Title */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Course registration is open"
                      className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                      required
                    />
                  </div>

                  {/* Content with Rich Text Toolbar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Content *
                    </label>
                    <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-[#1a66d6]">
                      {/* Formatting toolbar */}
                      <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
                        <button
                          type="button"
                          onClick={() => setContent((c) => c + ' **bold** ')}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Bold"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setContent((c) => c + ' *italic* ')}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Italic"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setContent((c) => c + ' <u>underline</u> ')}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Underline"
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                        <button
                          type="button"
                          onClick={() => setContent((c) => c + ' [link](https://...) ')}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Insert Link"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => success('Attachment', 'Attachment dialog opened.')}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Attach file"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setContent((c) => c + ' 😊 ')}
                          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Emoji"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <textarea
                        rows={6}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Write the full announcement details here..."
                        className="w-full p-3.5 text-xs sm:text-sm bg-transparent text-slate-900 dark:text-white focus:outline-none resize-y"
                        required
                      />
                    </div>
                  </div>

                  {/* Summary & Live character counter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Summary</label>
                    <input
                      type="text"
                      maxLength={140}
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Brief one-liner summary"
                      className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Shown in the list. {summary.length} of 140 characters.
                    </p>
                  </div>

                  {/* Priority & Category Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Priority buttons */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Priority
                      </label>
                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {(['General', 'Important', 'Urgent'] as PriorityType[]).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPriority(p)}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              priority === p
                                ? p === 'Urgent'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : p === 'Important'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category buttons */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Category
                      </label>
                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {(['Academic', 'Fees', 'Events', 'General'] as CategoryType[]).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCategory(c)}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              category === c
                                ? 'bg-[#1a66d6] text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audience Section */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#1a66d6] flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audience</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Who should see this?</p>
                    </div>
                  </div>

                  {/* Audience Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {audienceOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSelectedAudience(opt)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          selectedAudience === opt
                            ? 'bg-[#1a66d6] text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {/* Reach banner */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>
                      This will reach about <span className="font-bold">{totalStudentsCount} students</span>
                    </span>
                  </div>

                  {/* Pin to top & Acknowledgment toggles */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {/* Pin to top */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Pin className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Pin to top</p>
                          <p className="text-[11px] text-slate-500">Keep it first in the list</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPinned(!isPinned)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                          isPinned ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${
                            isPinned ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Require Acknowledgment */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">Require acknowledgment</p>
                          <p className="text-[11px] text-slate-500">Students must confirm they have read it</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRequiresAck(!requiresAck)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                          requiresAck ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${
                            requiresAck ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delivery Options */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delivery</h3>

                  {/* Mode tabs */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setDeliveryMode('draft')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        deliveryMode === 'draft'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Save as draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryMode('publish')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        deliveryMode === 'publish'
                          ? 'bg-[#1a66d6] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Publish now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryMode('schedule')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        deliveryMode === 'schedule'
                          ? 'bg-[#1a66d6] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Schedule</span>
                    </button>
                  </div>

                  {/* Schedule Date & Time if schedule selected */}
                  {deliveryMode === 'schedule' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Time
                        </label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Also notify by chips */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                      Also notify by
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNotifyChannels((c) => ({ ...c, inApp: !c.inApp }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          notifyChannels.inApp
                            ? 'bg-[#1a66d6] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        In-app
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifyChannels((c) => ({ ...c, email: !c.email }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          notifyChannels.email
                            ? 'bg-[#1a66d6] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifyChannels((c) => ({ ...c, push: !c.push }))}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          notifyChannels.push
                            ? 'bg-[#1a66d6] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Push
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSubmit('draft')}
                      className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Save draft</span>
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSubmit()}
                      className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {submitting
                          ? 'Saving...'
                          : deliveryMode === 'schedule'
                            ? `Schedule for ${scheduleDate.slice(5)}, ${scheduleTime}`
                            : deliveryMode === 'draft'
                              ? 'Save draft'
                              : 'Publish now'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Preview & Before you send */}
              <div className="space-y-6">
                {/* Live Preview Card */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                    Preview
                  </h3>

                  {/* Student Feed Style Card */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#1a66d6] dark:bg-blue-950 dark:text-[#4f9bff]">
                          {priority}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{category}</span>
                      </div>
                      {isPinned && <Pin className="w-3.5 h-3.5 text-[#1a66d6]" />}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {title || 'Announcement Title'}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                      {summary || content || 'Announcement content will appear here for students.'}
                    </p>

                    {requiresAck && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-semibold text-[#1a66d6]">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Acknowledgment required</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-3 text-center">How students see it in Communication.</p>
                </div>

                {/* Before you send Checklist */}
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Before you send</h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${title.trim() ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}
                      >
                        {title.trim() && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span className={title.trim() ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-400'}>
                        Title added
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${content.trim() ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}
                      >
                        {content.trim() && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span
                        className={content.trim() ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-400'}
                      >
                        Content added
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">Audience chosen</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">Delivery set</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── MAIN ANNOUNCEMENTS DASHBOARD & LIST VIEW ─── */
          <div className="space-y-6">
            {/* Header with Templates & Create buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">Communicate</p>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Announcements
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Create, schedule and manage announcements for your students.
                </p>
              </div>

              <div className="flex items-center gap-3 relative">
                {/* Templates Dropdown Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-800 dark:text-slate-100 shadow-xs transition-all"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Templates</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {templateDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] shadow-xl py-2 z-50 animate-in fade-in">
                      <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Start with a template
                      </p>
                      {TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handleUseTemplate(tpl)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                        >
                          <tpl.icon className="w-4 h-4 text-[#1a66d6]" />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{tpl.title}</p>
                            <p className="text-[10px] text-slate-500">{tpl.subtitle}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create Announcement Button */}
                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    setIsCreating(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create announcement</span>
                </button>
              </div>
            </div>

            {/* 5 Stat Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">TOTAL</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  PUBLISHED
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.published}</span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  SCHEDULED
                </span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.scheduled}</span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">DRAFTS</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.drafts}</span>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-4 shadow-sm col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  ARCHIVED
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.archived}</span>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              {/* Status pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'all', label: 'All', count: stats.total },
                  { key: 'published', label: 'Published', count: stats.published },
                  { key: 'draft', label: 'Draft', count: stats.drafts },
                  { key: 'scheduled', label: 'Scheduled', count: stats.scheduled },
                  { key: 'archived', label: 'Archived', count: stats.archived },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setStatusFilter(t.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      statusFilter === t.key
                        ? 'bg-[#1a66d6] text-white shadow-xs'
                        : 'bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{t.label}</span>
                    {t.key !== 'all' && <span className="ml-1 opacity-80">{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* Priorities & Categories dropdowns */}
              <div className="flex items-center gap-2">
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="all">All priorities</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Important">Important</option>
                  <option value="General">General</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="all">All categories</option>
                  <option value="Academic">Academic</option>
                  <option value="Fees">Fees</option>
                  <option value="Events">Events</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            {loading && <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Loading announcements…</p>}

            {/* ─── EMPTY STATE (Real empty state matching screenshot 1) ─── */}
            {filteredAnnouncements.length === 0 ? (
              <div className="space-y-8">
                <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-12 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center mx-auto mb-4">
                    <Volume2 className="w-8 h-8 stroke-[1.8]" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No announcements yet</h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                    Reach your students in seconds. Pick a template to start fast, or write one from scratch.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      handleResetForm();
                      setIsCreating(true);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-[#1554b3] text-white shadow-xs transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create announcement</span>
                  </button>
                </div>

                {/* Start from a template gallery */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                    Start from a template
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
                    {TEMPLATES.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => handleUseTemplate(tpl)}
                        className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm hover:border-[#1a66d6] cursor-pointer transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${tpl.iconColor}`}>
                            <tpl.icon className="w-4 h-4 stroke-[2.2]" />
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1">
                            {tpl.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{tpl.subtitle}</p>
                        </div>

                        <span className="text-xs font-semibold text-[#1a66d6] mt-4 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          Use template &rarr;
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ─── ANNOUNCEMENTS TABLE (List View matching screenshot 2) ─── */
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="py-3 px-4">Announcement</th>
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Audience and Acknowledgment</th>
                        <th className="py-3 px-4">Reach</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {filteredAnnouncements.map((ann) => {
                        const isPub = ann.status === 'published';
                        const isSched = ann.status === 'scheduled';
                        const ackRate =
                          ann.read_count > 0 ? Math.round((ann.acknowledged_count / ann.read_count) * 100) : 0;
                        const formattedDate = new Date(ann.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        });

                        return (
                          <tr
                            key={ann.id}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                          >
                            {/* Title & Metadata */}
                            <td className="py-4 px-4 min-w-[220px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {ann.title}
                                </span>
                                {ann.is_pinned && <Pin className="w-3.5 h-3.5 text-[#1a66d6] shrink-0 rotate-45" />}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {ann.category} · {formattedDate}
                              </p>
                            </td>

                            {/* Priority badge */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  ann.priority === 'Urgent'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                                    : ann.priority === 'Important'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {ann.priority}
                              </span>
                            </td>

                            {/* Status badge */}
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 font-semibold text-xs ${
                                  isPub
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : isSched
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-slate-500'
                                }`}
                              >
                                {isPub && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                {isSched && <Clock className="w-3.5 h-3.5" />}
                                <span className="capitalize">{ann.status}</span>
                              </span>
                            </td>

                            {/* Audience & Acknowledgment */}
                            <td className="py-4 px-4 min-w-[180px]">
                              <p className="font-semibold text-slate-900 dark:text-white text-xs">
                                {ann.target_audience?.[0] || 'All students'}
                              </p>
                              {ann.requires_acknowledgment ? (
                                <div className="mt-1 space-y-1">
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                    <span>
                                      {ann.acknowledged_count} of {totalStudentsCount}
                                    </span>
                                    <span>{ackRate}%</span>
                                  </div>
                                  <div className="w-32 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${Math.min(ackRate, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 mt-0.5">Not required</p>
                              )}
                            </td>

                            {/* Reach */}
                            <td className="py-4 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {ann.read_count > 0 ? `${ann.read_count} views` : '-'}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(ann.id);
                                    setTitle(ann.title);
                                    setContent(ann.content);
                                    setSummary(ann.summary || '');
                                    setPriority((ann.priority as PriorityType) || 'General');
                                    setCategory((ann.category as CategoryType) || 'Academic');
                                    setIsPinned(ann.is_pinned);
                                    setRequiresAck(ann.requires_acknowledgment);
                                    setIsCreating(true);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                                  title="Edit"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm('Delete this announcement?')) {
                                      await deleteAnnouncementV2(ann.id);
                                      success('Deleted', 'Announcement removed.');
                                      fetchData();
                                    }
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsManagePage;
