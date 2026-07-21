import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import {
  Megaphone, Plus, Edit3, Trash2, Eye, Send, Archive, Clock,
  Filter, Loader2, ChevronDown, BarChart3
} from 'lucide-react';
import {
  createAnnouncementV2, listAdminAnnouncements, getAnnouncementV2,
  updateAnnouncementV2, deleteAnnouncementV2, publishAnnouncement,
  archiveAnnouncement, getAnnouncementStats, listAnnouncementReceipts,
  getReceiptStats, listAnnouncementTemplates
} from '../../api/verification-announcements';
import type { AnnouncementV2, AnnouncementStatusCount, AnnouncementTemplate, ReceiptStats } from '../../api/verification-announcements';

type FormData = {
  title: string;
  content: string;
  summary: string;
  priority: string;
  category: string;
  target_audience: string[];
  target_levels: number[];
  is_pinned: boolean;
  requires_acknowledgment: boolean;
  status: string;
  scheduled_for: string;
};

const defaultForm: FormData = {
  title: '',
  content: '',
  summary: '',
  priority: 'General',
  category: 'Academic',
  target_audience: ['all'],
  target_levels: [],
  is_pinned: false,
  requires_acknowledgment: false,
  status: 'draft',
  scheduled_for: '',
};

const priorities = ['Urgent', 'Important', 'General', 'Reminder'];
const categories = ['Academic', 'Administrative', 'Event', 'Emergency', 'Fee', 'Result'];
const audiences = [
  { value: 'all', label: 'All Students' },
  { value: '100', label: '100 Level' },
  { value: '200', label: '200 Level' },
  { value: '300', label: '300 Level' },
  { value: '400', label: '400 Level' },
  { value: '500', label: '500 Level' },
  { value: 'alumni', label: 'Alumni' },
];

const statusTabs = ['all', 'published', 'draft', 'scheduled', 'archived'];

const priorityColor: Record<string, string> = {
  Urgent: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  Important: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  General: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300',
  Reminder: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
};

const statusColor: Record<string, string> = {
  published: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  draft: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300',
  scheduled: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
  archived: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
};

const AnnouncementsManagePage = () => {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();

  const [announcements, setAnnouncements] = useState<AnnouncementV2[]>([]);
  const [stats, setStats] = useState<AnnouncementStatusCount[]>([]);
  const [templates, setTemplates] = useState<AnnouncementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...defaultForm });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewModal, setViewModal] = useState<AnnouncementV2 | null>(null);
  const [viewReceipts, setViewReceipts] = useState<ReceiptStats | null>(null);

  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      const data = await listAdminAnnouncements(params as any);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch {
      notifyError('Load Failed', 'Could not load announcements');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, notifyError]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getAnnouncementStats();
      setStats(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await listAnnouncementTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    fetchStats();
    fetchTemplates();
  }, [fetchStats, fetchTemplates]);

  const statCount = (status: string) => {
    const found = stats.find((s) => s.status === status);
    return found ? found.count : 0;
  };

  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

  const setFormField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAudience = (value: string) => {
    setForm((prev) => {
      let next: string[];
      if (value === 'all') {
        next = prev.target_audience.includes('all') ? [] : ['all'];
      } else {
        next = prev.target_audience.filter((a) => a !== 'all');
        if (next.includes(value)) {
          next = next.filter((a) => a !== value);
        } else {
          next.push(value);
        }
        if (next.length === 0) next = ['all'];
      }
      return { ...prev, target_audience: next };
    });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setModalOpen(true);
  };

  const openEditModal = async (id: string) => {
    try {
      const ann = await getAnnouncementV2(id);
      setEditingId(id);
      setForm({
        title: ann.title,
        content: ann.content,
        summary: ann.summary || '',
        priority: ann.priority || 'General',
        category: ann.category || 'Academic',
        target_audience: ann.target_audience?.length ? ann.target_audience : ['all'],
        target_levels: ann.target_levels || [],
        is_pinned: ann.is_pinned,
        requires_acknowledgment: ann.requires_acknowledgment,
        status: ann.status === 'archived' ? 'draft' : ann.status,
        scheduled_for: ann.scheduled_for ? ann.scheduled_for.slice(0, 16) : '',
      });
      setModalOpen(true);
    } catch {
      notifyError('Load Failed', 'Could not load announcement');
    }
  };

  const applyTemplate = (template: AnnouncementTemplate) => {
    setForm((prev) => ({
      ...prev,
      title: template.default_title,
      content: template.default_body,
      priority: template.default_priority || prev.priority,
      category: template.default_category || prev.category,
      requires_acknowledgment: template.default_requires_acknowledgment,
    }));
    setTemplateDropdownOpen(false);
    if (!modalOpen) setModalOpen(true);
  };

  const handleSubmit = async (asPublish: boolean) => {
    if (!form.title.trim() || !form.content.trim()) {
      notifyError('Validation', 'Title and content are required');
      return;
    }
    try {
      setSubmitting(true);
      const payload: Record<string, any> = {
        title: form.title,
        content: form.content,
        summary: form.summary || undefined,
        priority: form.priority,
        category: form.category,
        target_audience: form.target_audience,
        is_pinned: form.is_pinned,
        requires_acknowledgment: form.requires_acknowledgment,
      };

      if (asPublish) {
        payload.status = 'published';
      } else if (form.status === 'scheduled' && form.scheduled_for) {
        payload.status = 'scheduled';
        payload.scheduled_for = new Date(form.scheduled_for).toISOString();
      } else {
        payload.status = 'draft';
      }

      if (editingId) {
        await updateAnnouncementV2(editingId, payload);
        success('Updated', 'Announcement updated successfully');
      } else {
        await createAnnouncementV2(payload as any);
        success('Created', 'Announcement created successfully');
      }
      setModalOpen(false);
      fetchAnnouncements();
      fetchStats();
    } catch (err: any) {
      notifyError('Save Failed', err?.response?.data?.error || err?.message || 'Could not save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncementV2(id);
      success('Deleted', 'Announcement deleted');
      setDeleteConfirmId(null);
      fetchAnnouncements();
      fetchStats();
    } catch (err: any) {
      notifyError('Delete Failed', err?.message || 'Could not delete');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveAnnouncement(id);
      success('Archived', 'Announcement archived');
      fetchAnnouncements();
      fetchStats();
    } catch (err: any) {
      notifyError('Archive Failed', err?.message || 'Could not archive');
    }
  };

  const openViewModal = async (ann: AnnouncementV2) => {
    setViewModal(ann);
    try {
      const rs = await getReceiptStats(ann.id);
      setViewReceipts(rs);
    } catch {
      setViewReceipts(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary-500" />
            Announcement Management
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create, schedule, and manage all campus-wide announcements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              size="md"
              rightIcon={<ChevronDown className="w-4 h-4" />}
              onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
            >
              Templates
            </Button>
            {templateDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg z-50 py-1">
                {templates.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-surface-500">No templates available</div>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t.id}
                      className="w-full text-left px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition"
                      onClick={() => applyTemplate(t)}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
            Create Announcement
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: totalCount, color: 'text-surface-900 dark:text-white' },
          { label: 'Published', value: statCount('published'), color: 'text-success-600 dark:text-success-400' },
          { label: 'Scheduled', value: statCount('scheduled'), color: 'text-info-600 dark:text-info-400' },
          { label: 'Drafts', value: statCount('draft'), color: 'text-surface-600 dark:text-surface-400' },
          { label: 'Archived', value: statCount('archived'), color: 'text-warning-600 dark:text-warning-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4"
          >
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Filter className="w-4 h-4 text-surface-400 shrink-0" />
            {statusTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition capitalize whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-primary-500 text-white'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="appearance-none w-40 pl-3 pr-8 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-700 dark:text-surface-300"
              >
                <option value="">All Priorities</option>
                {priorities.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="appearance-none w-40 pl-3 pr-8 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-700 dark:text-surface-300"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading announcements...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-16 text-center">
            <Megaphone className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-sm text-surface-500 dark:text-surface-400">No announcements found</p>
          </div>
        ) : (
          announcements.map((ann) => (
            <div
              key={ann.id}
              className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-5 hover:shadow-md transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-surface-900 dark:text-white truncate">
                      {ann.title}
                    </h3>
                    {ann.is_pinned && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-medium">
                        Pinned
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor[ann.priority] || ''}`}>
                      {ann.priority}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[ann.status] || ''}`}>
                      {ann.status}
                    </span>
                    {ann.requires_acknowledgment && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300 font-medium">
                        Ack Required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                    {ann.summary || ann.content.slice(0, 150)}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
                    <span className="flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5" />
                      {ann.read_count} reads
                    </span>
                    <span className="capitalize">{ann.category}</span>
                    <span>
                      {ann.target_audience?.includes('all')
                        ? 'All Students'
                        : ann.target_audience?.join(', ') || 'All'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(ann.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => openViewModal(ann)}
                  >
                    View
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                    onClick={() => openEditModal(ann.id)}
                  >
                    Edit
                  </Button>
                  {ann.status !== 'archived' && (
                    <Button
                      size="xs"
                      variant="ghost"
                      leftIcon={<Archive className="w-3.5 h-3.5" />}
                      onClick={() => handleArchive(ann.id)}
                    >
                      Archive
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => setDeleteConfirmId(ann.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white">
                {editingId ? 'Edit Announcement' : 'Create Announcement'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Title <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setFormField('title', e.target.value)}
                  placeholder="Announcement title"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-surface-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Content <span className="text-danger-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setFormField('content', e.target.value)}
                  placeholder="Write your announcement content..."
                  rows={6}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-surface-900 dark:text-white resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Summary
                </label>
                <input
                  type="text"
                  value={form.summary}
                  onChange={(e) => setFormField('summary', e.target.value)}
                  placeholder="Brief summary (shown in list view)"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-surface-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Priority</label>
                  <div className="relative">
                    <select
                      value={form.priority}
                      onChange={(e) => setFormField('priority', e.target.value)}
                      className="appearance-none w-full pl-3 pr-8 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white"
                    >
                      {priorities.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Category</label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={(e) => setFormField('category', e.target.value)}
                      className="appearance-none w-full pl-3 pr-8 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Target Audience</label>
                <div className="flex flex-wrap gap-2">
                  {audiences.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => toggleAudience(a.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                        form.target_audience.includes(a.value)
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-300 dark:border-surface-600 hover:border-primary-400'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(e) => setFormField('is_pinned', e.target.checked)}
                    className="w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-primary-500 focus:ring-primary-500/20"
                  />
                  Pin to top
                </label>
                <label className="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requires_acknowledgment}
                    onChange={(e) => setFormField('requires_acknowledgment', e.target.checked)}
                    className="w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-primary-500 focus:ring-primary-500/20"
                  />
                  Require acknowledgment
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Status</label>
                <div className="flex gap-3">
                  {[
                    { value: 'draft', label: 'Save as Draft' },
                    { value: 'publish', label: 'Publish Now' },
                    { value: 'scheduled', label: 'Schedule' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormField('status', opt.value)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                        form.status === opt.value
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-400 border-surface-300 dark:border-surface-600 hover:border-primary-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.status === 'scheduled' && (
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Schedule Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_for}
                    onChange={(e) => setFormField('scheduled_for', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white"
                  />
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                isLoading={submitting}
                onClick={() => handleSubmit(false)}
                leftIcon={<SaveIcon />}
              >
                Save Draft
              </Button>
              <Button
                isLoading={submitting}
                onClick={() => handleSubmit(true)}
                leftIcon={<Send className="w-4 h-4" />}
              >
                {editingId ? 'Update & Publish' : 'Publish'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-danger-500" />
            </div>
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">Delete Announcement</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
              This action cannot be undone. The announcement will be permanently removed.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setViewModal(null); setViewReceipts(null); }} />
          <div className="relative bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white">{viewModal.title}</h2>
              <button
                onClick={() => { setViewModal(null); setViewReceipts(null); }}
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityColor[viewModal.priority] || ''}`}>
                  {viewModal.priority}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[viewModal.status] || ''}`}>
                  {viewModal.status}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300 font-medium">
                  {viewModal.category}
                </span>
              </div>
              {viewModal.summary && (
                <p className="text-sm text-surface-600 dark:text-surface-400 italic">{viewModal.summary}</p>
              )}
              <div className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">
                {viewModal.content}
              </div>
              <div className="border-t border-surface-200 dark:border-surface-700 pt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-surface-500 dark:text-surface-400">Audience:</span>{' '}
                  <span className="text-surface-900 dark:text-white font-medium">
                    {viewModal.target_audience?.includes('all') ? 'All Students' : viewModal.target_audience?.join(', ')}
                  </span>
                </div>
                <div>
                  <span className="text-surface-500 dark:text-surface-400">Published:</span>{' '}
                  <span className="text-surface-900 dark:text-white font-medium">
                    {formatDate(viewModal.created_at)}
                  </span>
                </div>
                {viewReceipts && (
                  <>
                    <div>
                      <span className="text-surface-500 dark:text-surface-400">Read:</span>{' '}
                      <span className="text-surface-900 dark:text-white font-medium">{viewReceipts.read_count}</span>
                    </div>
                    <div>
                      <span className="text-surface-500 dark:text-surface-400">Acknowledged:</span>{' '}
                      <span className="text-surface-900 dark:text-white font-medium">{viewReceipts.ack_count}</span>
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <span className="text-surface-500 dark:text-surface-400">Pinned:</span>{' '}
                  <span className="text-surface-900 dark:text-white font-medium">{viewModal.is_pinned ? 'Yes' : 'No'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-surface-500 dark:text-surface-400">Acknowledgment Required:</span>{' '}
                  <span className="text-surface-900 dark:text-white font-medium">{viewModal.requires_acknowledgment ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => { setViewModal(null); setViewReceipts(null); }}
              >
                Close
              </Button>
              <Button
                leftIcon={<Edit3 className="w-4 h-4" />}
                onClick={() => {
                  const id = viewModal.id;
                  setViewModal(null);
                  setViewReceipts(null);
                  openEditModal(id);
                }}
              >
                Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {templateDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setTemplateDropdownOpen(false)} />
      )}
    </div>
  );
};

const SaveIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export default AnnouncementsManagePage;
