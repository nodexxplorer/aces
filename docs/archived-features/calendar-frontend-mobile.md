# Archived: Calendar (frontend + mobile only)

Scope: explicitly limited to the frontend and mobile UI for the departmental-events calendar and the ICS calendar-feed subscription flow. The Go backend (calendar feed token issuance, `getCalendarFeed`, departmental-event CRUD, ICS generation) and the database were deliberately left untouched.

## Restoration checklist

1. Recreate deleted files from the snippets below.
2. Re-apply the removed snippets to files that otherwise stayed.
3. Re-add the sidebar nav entry, router redirect, and the Communication-page/screen tab wiring.
4. No backend or migration changes are needed to restore this — the API was never removed.

## Deleted files

### `frontend/src/api/calendar.ts`
```ts
import apiClient from './client';

// A standing subscription feed (Timetable + Study Task due dates merged
// into one .ics) that Google/Apple/Outlook Calendar can "subscribe by
// URL" to — distinct from the one-off departmental-event .ics downloads
// in api/additional-features.ts.

export const getMyCalendarToken = async () => {
  const { data } = await apiClient.get<{ token: string }>('/calendar/token');
  return data.token;
};

export const regenerateMyCalendarToken = async () => {
  const { data } = await apiClient.post<{ token: string }>('/calendar/token/regenerate');
  return data.token;
};

export const getCalendarFeedUrl = (token: string) => {
  const base = apiClient.defaults.baseURL || '/api/v1';
  return `${base}/calendar/feed/${token}`;
};
```

### `frontend/src/components/features/CalendarSyncModal.tsx`
```tsx
import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { CalendarPlus, Copy, RefreshCw } from 'lucide-react';
import { getMyCalendarToken, regenerateMyCalendarToken, getCalendarFeedUrl } from '../../api/calendar';

const CalendarSyncModal = () => {
  const { success, error: notifyError } = useNotification();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');

  const openModal = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const token = await getMyCalendarToken();
      setFeedUrl(getCalendarFeedUrl(token));
    } catch {
      notifyError('Error', 'Failed to load your calendar link');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      success('Copied', 'Calendar link copied to clipboard');
    } catch {
      notifyError('Error', 'Could not copy — select and copy the link manually');
    }
  };

  const regenerate = async () => {
    if (!confirm('This breaks the old link — anywhere you already subscribed with it will stop updating. Continue?')) {
      return;
    }
    setRegenerating(true);
    try {
      const token = await regenerateMyCalendarToken();
      setFeedUrl(getCalendarFeedUrl(token));
      success('Link Regenerated', 'Update your calendar subscription with the new link');
    } catch {
      notifyError('Error', 'Failed to regenerate calendar link');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <>
      <Button variant="outline" leftIcon={<CalendarPlus className="w-4 h-4" />} onClick={openModal}>
        Sync to Google Calendar
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Sync to Google Calendar" size="md">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              This link keeps your class schedule and task due dates synced to any calendar app. In Google Calendar:{' '}
              <strong>Other calendars → + → From URL</strong>, then paste the link below.
            </p>

            <div className="flex gap-2">
              <Input readOnly value={feedUrl} onFocus={(e) => e.target.select()} className="flex-1" />
              <Button variant="outline" onClick={copyLink} leftIcon={<Copy className="w-4 h-4" />}>
                Copy
              </Button>
            </div>

            <div className="flex items-start gap-2 bg-warning-50 dark:bg-warning-500/10 rounded-lg p-3">
              <p className="text-xs text-warning-700 dark:text-warning-500">
                Anyone with this link can see your schedule and tasks. Keep it private, and regenerate it below if it's
                ever shared by accident. Calendar apps typically refresh a subscribed link every few hours, not
                instantly.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              isLoading={regenerating}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={regenerate}
            >
              Regenerate Link
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CalendarSyncModal;
```

### `frontend/src/pages/admin/CalendarPage.tsx`
```tsx
import { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Pencil,
  MapPin,
  Clock,
  Users,
  X,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
} from 'lucide-react';
import {
  listDepartmentalEvents,
  createDepartmentalEvent,
  updateDepartmentalEvent,
  deleteDepartmentalEvent,
  getEventICSDownloadUrl,
  type CalendarEvent,
} from '../../api/additional-features';
import { useAuth } from '../../hooks/useAuth';

const EVENT_TYPES = ['exam', 'deadline', 'meeting', 'holiday', 'event', 'custom'] as const;

const EVENT_TYPE_COLORS: Record<string, string> = {
  exam: '#ef4444',
  deadline: '#f97316',
  meeting: '#3b82f6',
  holiday: '#22c55e',
  event: '#a855f7',
  custom: '#6b7280',
};

const EVENT_TYPE_BADGES: Record<string, string> = {
  exam: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  deadline: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  holiday: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  event: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  custom: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const emptyForm = {
  title: '',
  description: '',
  event_type: 'event',
  start_time: '',
  end_time: '',
  venue: '',
  is_all_day: false,
  color: '#a855f7',
  target_audience: 'all',
};

type FormState = typeof emptyForm;

function toDatetimeLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const { user } = useAuth();
  const isAdmin = ['admin', 'superadmin', 'hod', 'delegated_admin'].includes(user?.role || '');

  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await listDepartmentalEvents();
      setEvents(data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    setForm((prev) => ({ ...prev, color: EVENT_TYPE_COLORS[prev.event_type] || '#a855f7' }));
  }, [form.event_type]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const goToToday = () => setCurrentDate(new Date());
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredEvents.filter((e) => {
      const start = e.start_time?.slice(0, 10);
      const end = e.end_time?.slice(0, 10);
      if (start && end) return dateStr >= start && dateStr <= end;
      if (start) return dateStr === start;
      return false;
    });
  };

  const filteredEvents = events.filter((e) => typeFilter.length === 0 || typeFilter.includes(e.event_type));

  const toggleFilter = (type: string) => {
    setTypeFilter((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const openCreateForm = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (event: CalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      start_time: toDatetimeLocal(event.start_time),
      end_time: event.end_time ? toDatetimeLocal(event.end_time) : '',
      venue: event.venue || '',
      is_all_day: event.is_all_day,
      color: event.color || EVENT_TYPE_COLORS[event.event_type] || '#a855f7',
      target_audience: Array.isArray(event.target_audience) ? event.target_audience[0] || 'all' : 'all',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description || undefined,
      event_type: form.event_type,
      start_time: new Date(form.start_time).toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : undefined,
      venue: form.venue || undefined,
      is_all_day: form.is_all_day,
      color: form.color,
      target_audience: [form.target_audience],
    };
    try {
      if (editingEvent) {
        await updateDepartmentalEvent(editingEvent.id, payload);
      } else {
        await createDepartmentalEvent(payload);
      }
      setShowForm(false);
      setEditingEvent(null);
      setForm(emptyForm);
      fetchEvents();
    } catch (err) {
      console.error('Failed to save event:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await deleteDepartmentalEvent(id);
      setDetailEvent(null);
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  const selectedDayEvents = selectedDay !== null ? getEventsForDay(selectedDay) : [];

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Departmental Calendar</h1>
              <p className="text-sm text-surface-500 dark:text-surface-400">Manage department events and schedules</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
          )}
        </div>

        {/* Create/Edit Event Form */}
        {showForm && (
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingEvent(null);
                }}
                className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
              >
                <X className="w-4 h-4 text-surface-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Event title"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  rows={3}
                  placeholder="Event description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Event Type
                </label>
                <select
                  value={form.event_type}
                  onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-surface-300 dark:border-surface-700 cursor-pointer"
                  />
                  <span className="text-sm text-surface-500 dark:text-surface-400">{form.color}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Venue</label>
                <input
                  type="text"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. Hall A, Room 301"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Target Audience
                </label>
                <select
                  value={form.target_audience}
                  onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="all">All</option>
                  <option value="students">Students</option>
                  <option value="staff">Staff</option>
                  <option value="faculty">Faculty</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_all_day"
                  checked={form.is_all_day}
                  onChange={(e) => setForm({ ...form, is_all_day: e.target.checked })}
                  className="w-4 h-4 rounded border-surface-300 dark:border-surface-700 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_all_day" className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  All-day event
                </label>
              </div>

              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                >
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEvent(null);
                  }}
                  className="px-6 py-2 bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Event Type Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-surface-500" />
          <span className="text-sm font-medium text-surface-600 dark:text-surface-400">Filter:</span>
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                typeFilter.includes(type)
                  ? `${EVENT_TYPE_BADGES[type]} border-current`
                  : 'bg-white dark:bg-surface-900 text-surface-500 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: EVENT_TYPE_COLORS[type] }}
              />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
          {typeFilter.length > 0 && (
            <button onClick={() => setTypeFilter([])} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors text-surface-900 dark:text-surface-500"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  {MONTH_NAMES[month]} {year}
                </h2>
                <button
                  onClick={goToToday}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Today
                </button>
              </div>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors text-surface-900 dark:text-surface-500"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-surface-500 dark:text-surface-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = getEventsForDay(day);
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSelected = day === selectedDay;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`aspect-square p-1 rounded-lg border text-sm flex flex-col items-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500/30'
                        : isToday
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800'
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-surface-700 dark:text-surface-300'}`}
                    >
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <div
                            key={ev.id}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: ev.color || EVENT_TYPE_COLORS[ev.event_type] }}
                            title={ev.title}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-surface-500">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Color Legend */}
            <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-800">
              <p className="text-[10px] font-medium text-surface-500 dark:text-surface-400 mb-2 uppercase tracking-wider">
                Legend
              </p>
              <div className="flex flex-wrap gap-3">
                {EVENT_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS[type] }} />
                    <span className="text-[11px] text-surface-600 dark:text-surface-400">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected Day Events */}
            {selectedDay !== null && (
              <div className="bg-white dark:bg-surface-900 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    {MONTH_NAMES[month]} {selectedDay}, {year}
                  </h3>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
                  >
                    <X className="w-3.5 h-3.5 text-surface-400" />
                  </button>
                </div>
                {selectedDayEvents.length === 0 ? (
                  <p className="text-xs text-surface-500 dark:text-surface-400 text-center py-4">
                    No events on this day
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setDetailEvent(ev)}
                        className="w-full text-left p-3 rounded-xl border border-surface-200 dark:border-surface-700 hover:shadow-md transition-shadow"
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: ev.color || EVENT_TYPE_COLORS[ev.event_type],
                        }}
                      >
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                          {ev.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${EVENT_TYPE_BADGES[ev.event_type] || EVENT_TYPE_BADGES.custom}`}
                          >
                            {ev.event_type}
                          </span>
                          {ev.start_time && (
                            <span className="text-[10px] text-surface-500">
                              {new Date(ev.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Events */}
            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">Upcoming Events</h3>
              {loading ? (
                <div className="text-center py-8 text-surface-500 dark:text-surface-400">Loading events...</div>
              ) : sortedEvents.length === 0 ? (
                <div className="text-center py-8 text-surface-500 dark:text-surface-400">
                  {typeFilter.length > 0 ? 'No events match the selected filters' : 'No events scheduled'}
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {sortedEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setDetailEvent(event)}
                      className="w-full text-left p-3 rounded-xl border border-surface-200 dark:border-surface-700 hover:shadow-md transition-shadow"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: event.color || EVENT_TYPE_COLORS[event.event_type],
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-surface-900 dark:text-surface-100 truncate">{event.title}</h4>
                          {event.description && (
                            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${EVENT_TYPE_BADGES[event.event_type] || EVENT_TYPE_BADGES.custom}`}
                            >
                              {event.event_type}
                            </span>
                            {event.start_time && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-surface-500 dark:text-surface-400">
                                <Clock className="w-3 h-3" />
                                {new Date(event.start_time).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openEditForm(event)}
                              className="p-1.5 text-surface-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Edit event"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Detail Modal */}
        {detailEvent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDetailEvent(null)}
          >
            <div
              className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-xl w-full max-w-md p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-surface-900 dark:text-white">{detailEvent.title}</h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-2 ${EVENT_TYPE_BADGES[detailEvent.event_type] || EVENT_TYPE_BADGES.custom}`}
                  >
                    {detailEvent.event_type}
                  </span>
                </div>
                <button
                  onClick={() => setDetailEvent(null)}
                  className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg shrink-0"
                >
                  <X className="w-4 h-4 text-surface-500" />
                </button>
              </div>

              {detailEvent.description && (
                <p className="text-sm text-surface-600 dark:text-surface-400">{detailEvent.description}</p>
              )}

              <div className="space-y-2">
                {detailEvent.start_time && (
                  <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                    <Clock className="w-4 h-4 text-surface-400" />
                    <span>
                      {new Date(detailEvent.start_time).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {detailEvent.end_time &&
                        ` — ${new Date(detailEvent.end_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                )}
                {detailEvent.venue && (
                  <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                    <MapPin className="w-4 h-4 text-surface-400" />
                    <span>{detailEvent.venue}</span>
                  </div>
                )}
                {detailEvent.target_audience && (
                  <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                    <Users className="w-4 h-4 text-surface-400" />
                    <span>
                      {Array.isArray(detailEvent.target_audience)
                        ? detailEvent.target_audience.join(', ')
                        : detailEvent.target_audience}
                    </span>
                  </div>
                )}
                {detailEvent.is_all_day && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    All-day event
                  </span>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-surface-200 dark:border-surface-800 flex-wrap">
                <a
                  href={getEventICSDownloadUrl(detailEvent.id)}
                  download
                  className="flex items-center gap-1.5 px-4 py-2 bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl text-sm font-medium transition-colors"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Add to Calendar
                </a>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => {
                        openEditForm(detailEvent);
                        setDetailEvent(null);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(detailEvent.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### `mobile/src/api/calendar.ts`
```ts
import apiClient, { unwrap } from './client';

export interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  venue?: string;
  is_all_day: boolean;
  color: string;
  created_at: string;
  creator_name?: string;
}

export const listDepartmentalEvents = async (start?: string, end?: string) => {
  const res = await apiClient.get('/calendar', { params: { start, end } });
  return unwrap<CalendarEvent[]>(res);
};
```

### `mobile/src/utils/calendar.ts`
```ts
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import apiClient from '../api/client';

// Fetches a backend-generated .ics file and hands it to the OS share sheet —
// on iOS/Android that's "Add to Calendar" / "Open with <calendar app>",
// which works for Google Calendar, Apple Calendar, Outlook, etc. without any
// Google/Microsoft login or API integration on our side.
async function shareICS(url: string, filename: string) {
  if (Platform.OS === 'web') {
    Alert.alert('Not Supported', 'Adding to calendar from the web preview is not supported — use the mobile app.');
    return;
  }

  const res = await apiClient.get<string>(url, { responseType: 'text' });

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(res.data);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('Not Supported', "Your device doesn't support sharing files.");
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', dialogTitle: 'Add to Calendar', UTI: 'com.apple.ical.ics' });
}

export async function addDepartmentalEventToCalendar(eventId: string) {
  await shareICS(`/calendar/${eventId}/ics`, `event-${eventId}.ics`);
}
```


### Removed from `frontend/src/api/additional-features.ts` (lines 195-275 originally; `parseJSONField` at the top of this file is SHARED with Class Notices and Feature Flags and was NOT removed)

```ts
// Calendar Events
export interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  venue?: string;
  target_levels?: number[];
  target_audience?: string[];
  is_all_day: boolean;
  color: string;
  created_at: string;
  creator_name?: string;
}

export const createDepartmentalEvent = async (data: {
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  venue?: string;
  target_levels?: number[];
  target_audience?: string[];
  is_all_day?: boolean;
  color?: string;
}) => {
  const res = await apiClient.post('/calendar', data);
  return unwrap<CalendarEvent>(res);
};

export const listDepartmentalEvents = async (start?: string, end?: string) => {
  const params: Record<string, string> = {};
  if (start) params.start = start;
  if (end) params.end = end;
  const res = await apiClient.get('/calendar', { params });
  const events = unwrap<CalendarEvent[]>(res);
  // target_levels/target_audience are jsonb columns — same base64-string
  // shape as evidence_urls/target_user_ids above, must go through the same
  // parser or Array.isArray checks downstream silently treat them as unset.
  return events.map((e) => ({
    ...e,
    target_levels: parseJSONField<number>(e.target_levels),
    target_audience: parseJSONField<string>(e.target_audience),
  }));
};

export const deleteDepartmentalEvent = async (id: string) => {
  const res = await apiClient.delete(`/calendar/${id}`);
  return unwrap<{ message: string }>(res);
};

export const updateDepartmentalEvent = async (
  id: string,
  data: {
    title: string;
    description?: string;
    event_type: string;
    start_time: string;
    end_time?: string;
    venue?: string;
    target_levels?: number[];
    target_audience?: string[];
    is_all_day?: boolean;
    color?: string;
  },
) => {
  const res = await apiClient.put(`/calendar/${id}`, data);
  return unwrap<{ data: string }>(res);
};

// A direct .ics download link — any phone/desktop calendar app can import
// this via "Add to Calendar".
export const getEventICSDownloadUrl = (id: string) => {
  const base = apiClient.defaults.baseURL || '';
  return `${base}/calendar/${id}/ics`;
};

```

### Removed from `frontend/src/components/layout/Sidebar.tsx`

```tsx
  {
    label: 'Calendar',
    path: '/calendar',
    icon: Calendar,
    roles: [
      'student',
      'lecturer',
      'class_rep',
      'class_bursar',
      'dept_bursar',
      'alumni',
      'hod',
      'delegated_admin',
      'admin',
    ],
  },
```
(`Calendar` icon import kept — still used elsewhere in this file, e.g. the admin "Sessions" nav entry.)

### Removed from `frontend/src/router.tsx`

```tsx
          { path: '/calendar', element: <Navigate to="/communication?tab=calendar" replace /> },
```

### Original `frontend/src/pages/student/StudentCommunicationPage.tsx` (Calendar tab removed; Notifications/Announcements/Notice Board tabs kept)

```tsx
import { useState } from 'react';
import { Bell, Megaphone, Pin, Calendar } from 'lucide-react';
import Tabs from '../../components/ui/Tabs';
import NotificationsTab from '../shared/NotificationsPage';
import AnnouncementsTab from '../shared/StudentAnnouncementsPage';
import NoticesTab from '../shared/ClassNoticeBoardPage';
import CalendarTab from '../admin/CalendarPage';

const communicationTabs = [
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
  { id: 'notices', label: 'Notice Board', icon: <Pin className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
];

export default function StudentCommunicationPage() {
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState(
    communicationTabs.some((t) => t.id === initialTab) ? (initialTab as string) : 'notifications',
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Communication</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Notifications, announcements, and class notices
          </p>
        </div>

        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
          <div className="px-4">
            <Tabs tabs={communicationTabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>

          <div className="p-4">
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'announcements' && <AnnouncementsTab />}
            {activeTab === 'notices' && <NoticesTab />}
            {activeTab === 'calendar' && <CalendarTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Removed from `frontend/src/pages/student/StudyPlannerPage.tsx`

Import: `import CalendarSyncModal from '../../components/features/CalendarSyncModal';`
JSX: `<CalendarSyncModal />` (rendered next to the "AI Study Plan" button in the page header). The `Calendar` lucide icon import/usages (lines 232, 288) are unrelated decorative icons for due-date fields and were kept.

### Original `mobile/app/(tabs)/communication.tsx` (Calendar tab removed; Notifications/Announcements/Notice Board tabs kept, including shared `noticeMetaRow`/`noticeMetaItem` styles used by both Notice Board and the removed Calendar tab)

```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import Text from '../../src/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeProvider';
import { fontFamily, fontSize, radius, spacing } from '../../src/theme/typography';
import Screen from '../../src/components/ui/Screen';
import Card from '../../src/components/ui/Card';
import Badge from '../../src/components/ui/Badge';
import {
  listMyNotifications,
  listAnnouncementsFeed,
  markNotificationRead,
  listClassNotices,
  listNoticeComments,
  createNoticeComment,
  type NotificationItem,
  type AnnouncementFeedItem,
  type ClassNotice,
  type NoticeComment,
} from '../../src/api/communication';
import { listDepartmentalEvents, type CalendarEvent } from '../../src/api/calendar';

const EVENT_TYPE_LABELS: Record<string, string> = {
  academic: 'Academic',
  social: 'Social',
  deadline: 'Deadline',
  holiday: 'Holiday',
  exam: 'Exam',
  meeting: 'Meeting',
  other: 'Other',
};

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function CommunicationScreen() {
  const { theme } = useTheme();
  const [tab, setTab] = useState<'notifications' | 'announcements' | 'notices' | 'calendar'>('notifications');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [notices, setNotices] = useState<ClassNotice[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, NoticeComment[]>>({});
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchAll = useCallback(async () => {
    const [notifs, ann, notic, evts] = await Promise.allSettled([
      listMyNotifications(),
      listAnnouncementsFeed(),
      listClassNotices(),
      listDepartmentalEvents(new Date().toISOString()),
    ]);
    if (notifs.status === 'fulfilled') setNotifications(notifs.value);
    if (ann.status === 'fulfilled') setAnnouncements(ann.value);
    if (notic.status === 'fulfilled') setNotices(notic.value);
    if (evts.status === 'fulfilled') {
      setEvents(
        [...evts.value].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
      );
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleReadNotification = async (n: NotificationItem) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
    try {
      await markNotificationRead(n.id);
    } catch {
      // optimistic update stands even if the sync call fails silently
    }
  };

  const handleToggleNotice = (noticeId: string) => {
    const opening = expandedNoticeId !== noticeId;
    setExpandedNoticeId(opening ? noticeId : null);
    setCommentText('');
    if (opening && !commentsMap[noticeId]) {
      setLoadingComments(true);
      listNoticeComments(noticeId)
        .then((comments) => setCommentsMap((prev) => ({ ...prev, [noticeId]: comments })))
        .catch(() => {})
        .finally(() => setLoadingComments(false));
    }
  };

  const handleSubmitComment = async (noticeId: string) => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await createNoticeComment(noticeId, commentText.trim());
      setCommentsMap((prev) => ({ ...prev, [noticeId]: [...(prev[noticeId] ?? []), newComment] }));
      setCommentText('');
    } catch {
      // input keeps its text on failure so the student can retry
    } finally {
      setSubmittingComment(false);
    }
  };

  const pinnedNotices = notices.filter((n) => n.is_pinned);
  const regularNotices = notices.filter((n) => !n.is_pinned);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.header, { color: theme.text }]}>Communication</Text>

      <View style={[styles.tabRow, { borderColor: theme.divider }]}>
        {(['notifications', 'announcements', 'notices', 'calendar'] as const).map((t) => (
          <Text
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabLabel,
              { color: tab === t ? theme.primary : theme.textMuted },
              tab === t && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
            ]}
          >
            {t === 'notifications'
              ? 'Notifications'
              : t === 'announcements'
                ? 'Announcements'
                : t === 'notices'
                  ? 'Notice Board'
                  : 'Calendar'}
          </Text>
        ))}
      </View>

      {tab === 'notifications' ? (
        <FlatList
          data={notifications}
          scrollEnabled={false}
          keyExtractor={(n) => n.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  You're all caught up — no notifications.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Pressable onPress={() => handleReadNotification(item)}>
                <Card style={styles.notifCard}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: item.is_read ? 'transparent' : theme.primary },
                    ]}
                  />
                  <View style={styles.flex}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: theme.text, fontFamily: item.is_read ? fontFamily.medium : fontFamily.semibold },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text style={[styles.itemBody, { color: theme.textMuted }]} numberOfLines={2}>
                      {item.message}
                    </Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(item.created_at)}</Text>
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          )}
        />
      ) : tab === 'announcements' ? (
        <FlatList
          data={announcements}
          scrollEnabled={false}
          keyExtractor={(a) => a.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No announcements right now.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Card>
                <View style={styles.announcementHeader}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.is_pinned && <Ionicons name="pin" size={14} color={theme.primary} />}
                </View>
                <Text style={[styles.itemBody, { color: theme.textMuted }]} numberOfLines={3}>
                  {item.content}
                </Text>
                <View style={styles.announcementFooter}>
                  <Badge label={item.category} tone="neutral" />
                  <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(item.created_at)}</Text>
                </View>
              </Card>
            </Animated.View>
          )}
        />
      ) : tab === 'notices' ? (
        <View style={{ gap: spacing.lg }}>
          {!loading && notices.length === 0 && (
            <Card>
              <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                No notices posted yet.
              </Text>
            </Card>
          )}

          {pinnedNotices.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              <View style={styles.noticeSectionHeader}>
                <Ionicons name="pin" size={14} color={theme.warning} />
                <Text style={[styles.noticeSectionLabel, { color: theme.warning }]}>PINNED</Text>
              </View>
              {pinnedNotices.map((n) => renderNotice(n))}
            </View>
          )}

          {regularNotices.length > 0 && (
            <View style={{ gap: spacing.sm }}>
              {pinnedNotices.length > 0 && (
                <View style={styles.noticeSectionHeader}>
                  <Ionicons name="megaphone" size={14} color={theme.textFaint} />
                  <Text style={[styles.noticeSectionLabel, { color: theme.textFaint }]}>RECENT</Text>
                </View>
              )}
              {regularNotices.map((n) => renderNotice(n))}
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={events}
          scrollEnabled={false}
          keyExtractor={(e) => e.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <Card>
                <Text style={{ color: theme.textMuted, fontFamily: fontFamily.regular, fontSize: fontSize.sm }}>
                  No upcoming events.
                </Text>
              </Card>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(350).delay(index * 40)}>
              <Card style={[styles.eventCard, { borderLeftColor: item.color || theme.primary }]}>
                <View style={styles.announcementHeader}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Badge label={EVENT_TYPE_LABELS[item.event_type] ?? item.event_type} tone="neutral" />
                </View>
                {item.description ? (
                  <Text style={[styles.itemBody, { color: theme.textMuted }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.noticeMetaRow}>
                  <View style={styles.noticeMetaItem}>
                    <Ionicons name="calendar-outline" size={12} color={theme.textFaint} />
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{formatEventDate(item.start_time)}</Text>
                  </View>
                  {!item.is_all_day && (
                    <View style={styles.noticeMetaItem}>
                      <Ionicons name="time-outline" size={12} color={theme.textFaint} />
                      <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{formatEventTime(item.start_time)}</Text>
                    </View>
                  )}
                  {item.venue ? (
                    <View style={styles.noticeMetaItem}>
                      <Ionicons name="location-outline" size={12} color={theme.textFaint} />
                      <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{item.venue}</Text>
                    </View>
                  ) : null}
                </View>
              </Card>
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );

  function renderNotice(notice: ClassNotice) {
    const isExpanded = expandedNoticeId === notice.id;
    const comments = commentsMap[notice.id] ?? [];

    return (
      <Card
        key={notice.id}
        style={[notice.is_pinned && { borderLeftWidth: 3, borderLeftColor: theme.warning }]}
      >
        <Pressable onPress={() => handleToggleNotice(notice.id)}>
          <View style={styles.announcementHeader}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {notice.title}
            </Text>
            <Ionicons name="chatbubble-outline" size={14} color={theme.textFaint} />
          </View>
          <Text
            style={[styles.itemBody, { color: theme.textMuted }]}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {notice.content}
          </Text>
          <View style={styles.noticeMetaRow}>
            {notice.author_name && (
              <Text style={[styles.itemMeta, { color: theme.textMuted, fontFamily: fontFamily.medium }]}>
                {notice.author_name}
              </Text>
            )}
            <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(notice.created_at)}</Text>
            <View style={styles.noticeMetaItem}>
              <Ionicons name="chatbubble-outline" size={11} color={theme.textFaint} />
              <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{notice.comment_count ?? 0}</Text>
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={[styles.commentsBlock, { borderTopColor: theme.divider }]}>
            {loadingComments && !commentsMap[notice.id] ? (
              <Text style={{ color: theme.textFaint, fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>
                Loading comments...
              </Text>
            ) : comments.length === 0 ? (
              <Text style={{ color: theme.textFaint, fontFamily: fontFamily.regular, fontSize: fontSize.xs }}>
                No comments yet. Be the first to comment.
              </Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={[styles.commentBubble, { backgroundColor: theme.background }]}>
                  <View style={styles.noticeMetaItem}>
                    <Text style={[styles.commentAuthor, { color: theme.text }]}>{c.author_name}</Text>
                    <Text style={[styles.itemMeta, { color: theme.textFaint }]}>{timeAgo(c.created_at)}</Text>
                  </View>
                  <Text style={[styles.itemBody, { color: theme.textMuted, marginTop: 2 }]}>{c.content}</Text>
                </View>
              ))
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Write a comment..."
                placeholderTextColor={theme.textFaint}
                style={[styles.commentInput, { backgroundColor: theme.background, color: theme.text }]}
                onSubmitEditing={() => handleSubmitComment(notice.id)}
              />
              <Pressable
                onPress={() => handleSubmitComment(notice.id)}
                disabled={!commentText.trim() || submittingComment}
                style={[
                  styles.commentSendButton,
                  { backgroundColor: theme.primary, opacity: !commentText.trim() || submittingComment ? 0.5 : 1 },
                ]}
              >
                <Ionicons name="send" size={14} color={theme.onPrimary} />
              </Pressable>
            </View>
          </View>
        )}
      </Card>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['2xl'],
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xl,
  },
  tabLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    paddingBottom: spacing.sm,
  },
  notifCard: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginTop: 6,
  },
  itemName: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
  },
  itemBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: 2,
    lineHeight: 18,
  },
  itemMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  noticeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  noticeSectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
  },
  noticeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  noticeMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  commentsBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  commentBubble: {
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  commentAuthor: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  commentInput: {
    flex: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  commentSendButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCard: {
    borderLeftWidth: 3,
  },
  announcementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});
```
