import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import {
  Plus, Loader2, CalendarDays, AlertTriangle, Trash2, Eye, EyeOff, ChevronDown,
  MapPin, Clock, User, BookOpen, GraduationCap, Filter,
} from 'lucide-react';
import {
  getTimetable, createTimetableEntry, updateTimetableEntry, deleteTimetableEntry,
  checkTimetableConflicts, publishTimetable, bulkDeleteTimetable,
} from '../../api/timetable';
import { getCourses } from '../../api/courses';
import type { TimetableEntry, TimetableConflict, EntryType, ClassType } from '../../types';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const numToDay: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
const dayToNum: Record<string, number> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
const hours = Array.from({ length: 14 }, (_, i) => i + 7);
const levels = [100, 200, 300, 400, 500];
const classTypes: { value: string; label: string }[] = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Lab' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'seminar', label: 'Seminar' },
];
const examTypes = [
  { value: 'main', label: 'Main Exam' },
  { value: 'carryover', label: 'Carryover' },
];

const colorMap: Record<string, string> = {
  lecture: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  lab: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
  tutorial: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  seminar: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
};

const extractHour = (v: string) => {
  if (!v) return 0;
  const timePart = v.includes(' ') ? v.split(' ')[1] : v;
  return parseInt(timePart.split(':')[0]) || 0;
};

const formatTime = (v: string) => {
  if (!v) return '';
  const timePart = v.includes(' ') ? v.split(' ')[1] : v;
  const parts = timePart.split(':');
  const h = parseInt(parts[0]) || 0;
  const m = parts[1] || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suffix}`;
};

const TimetableManagePage = () => {
  const { success, error: notifyError } = useNotification();
  const [tab, setTab] = useState<EntryType>('class');
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);
  const [conflictCount, setConflictCount] = useState(0);
  const [showConflicts, setShowConflicts] = useState(false);
  const [levelFilter, setLevelFilter] = useState<number | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [courseId, setCourseId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [venue, setVenue] = useState('');
  const [level, setLevel] = useState<number>(100);
  const [classType, setClassType] = useState<string>('lecture');
  const [examType, setExamType] = useState<string>('main');
  const [lecturerId, setLecturerId] = useState('');
  const [invigilators, setInvigilators] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { entryType: tab };
      if (levelFilter) params.level = levelFilter;
      const [entriesRes, coursesRes] = await Promise.allSettled([
        getTimetable(params as any),
        getCourses({ page: 1, perPage: 200 }),
      ]);
      if (entriesRes.status === 'fulfilled') {
        setEntries(Array.isArray(entriesRes.value) ? entriesRes.value : []);
      }
      if (coursesRes.status === 'fulfilled') {
        const r = coursesRes.value as any;
        const courseList = Array.isArray(r) ? r : (r?.items || r?.data || []);
        setCourses(courseList.filter((c: any) => c && c.id && c.code && c.title));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab, levelFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setCourseId('');
    setDayOfWeek(1);
    setStartTime('08:00');
    setEndTime('10:00');
    setVenue('');
    setLevel(100);
    setClassType('lecture');
    setExamType('main');
    setLecturerId('');
    setInvigilators('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !startTime || !endTime || !venue) {
      notifyError('Validation', 'Please fill all required fields');
      return;
    }
    try {
      setSubmitting(true);
      await createTimetableEntry({
        courseId,
        dayOfWeek: tab === 'class' ? dayOfWeek : undefined,
        startTime,
        endTime,
        venue,
        level,
        entryType: tab,
        classType: tab === 'class' ? classType : undefined,
        examType: tab === 'exam' ? examType : undefined,
        lecturerId: lecturerId || undefined,
        invigilators: invigilators || undefined,
      });
      setCreateOpen(false);
      resetForm();
      success('Entry Created', `${tab === 'class' ? 'Class' : 'Exam'} entry added successfully`);
      fetchData();
    } catch (err: any) {
      notifyError('Create Failed', err?.response?.data?.error || err?.message || 'Could not create entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    try {
      setSubmitting(true);
      await updateTimetableEntry(editingEntry.id, {
        courseId,
        dayOfWeek: tab === 'class' ? dayOfWeek : undefined,
        startTime,
        endTime,
        venue,
        level,
        entryType: tab,
        classType: tab === 'class' ? classType : undefined,
        examType: tab === 'exam' ? examType : undefined,
        lecturerId: lecturerId || undefined,
        invigilators: invigilators || undefined,
      });
      setEditOpen(false);
      setEditingEntry(null);
      resetForm();
      success('Entry Updated', 'Timetable entry updated');
      fetchData();
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.error || err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: TimetableEntry) => {
    if (!confirm(`Delete ${entry.courseCode} timetable entry?`)) return;
    try {
      await deleteTimetableEntry(entry.id);
      success('Deleted', 'Entry removed');
      fetchData();
    } catch (err: any) {
      notifyError('Delete Failed', err?.response?.data?.error || err?.message);
    }
  };

  const openEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setCourseId(entry.course_id);
    setDayOfWeek(entry.day_of_week || 1);
    const st = entry.start_time?.includes(' ') ? entry.start_time.split(' ')[1]?.substring(0, 5) : entry.start_time?.substring(0, 5);
    const et = entry.end_time?.includes(' ') ? entry.end_time.split(' ')[1]?.substring(0, 5) : entry.end_time?.substring(0, 5);
    setStartTime(st || '08:00');
    setEndTime(et || '10:00');
    setVenue(entry.venue);
    setLevel(entry.level || 100);
    setClassType(entry.class_type || 'lecture');
    setExamType(entry.exam_type || 'main');
    setLecturerId(entry.lecturer_id || '');
    setInvigilators(entry.invigilators || '');
    setEditOpen(true);
  };

  const handleCheckConflicts = async () => {
    try {
      const params: Record<string, any> = { entryType: tab };
      if (levelFilter) params.level = levelFilter;
      const res = await checkTimetableConflicts(tab, levelFilter || undefined);
      setConflicts(res.conflicts || []);
      setConflictCount(res.conflict_count || 0);
      setShowConflicts(true);
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.error || 'Failed to check conflicts');
    }
  };

  const handlePublish = async (publish: boolean) => {
    try {
      await publishTimetable(tab, publish);
      success(publish ? 'Published' : 'Unpublished', `${tab === 'class' ? 'Class' : 'Exam'} timetable ${publish ? 'published' : 'unpublished'}`);
      fetchData();
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.error || 'Operation failed');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ALL ${tab} timetable entries${levelFilter ? ` for level ${levelFilter}` : ''}?`)) return;
    try {
      const res = await bulkDeleteTimetable(tab, levelFilter || undefined);
      success('Deleted', `${res.deleted || 0} entries removed`);
      fetchData();
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.error || 'Failed to delete');
    }
  };

  const getSlotAt = (day: string, hour: number) => {
    return entries.find((s) => {
      const dayNum = s.day_of_week;
      if (!dayNum) return false;
      if (numToDay[dayNum] !== day) return false;
      const sh = extractHour(s.start_time);
      const eh = extractHour(s.end_time);
      return hour >= sh && hour < eh;
    });
  };

  const isPublished = entries.length > 0 && entries.every((e) => e.is_published);

  const CourseForm = ({ isEdit }: { isEdit: boolean }) => (
    <form onSubmit={isEdit ? handleEdit : handleCreate} className="space-y-2 ">
      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Course *</label>
        <select
          className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          required
        >
          <option value="">Select course... {courses.length === 0 && '(Loading...)'}</option>
          {courses && courses.length > 0 && courses.map((c: any) => (
            <option key={c?.id || 'null'} value={c?.id || ''}>{c?.code} — {c?.title}</option>
          ))}
          {courses && courses.length === 0 && <option disabled>No courses available</option>}
        </select>
      </div>

      {tab === 'class' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Day *</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
          >
            {days.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Start Time *</label>
          <input
            type="time"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">End Time *</label>
          <input
            type="time"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Venue *</label>
          <input
            type="text"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            placeholder="e.g. LT 301"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Level *</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          >
            {levels.map((l) => <option key={l} value={l}>{l} Level</option>)}
          </select>
        </div>
      </div>

      {tab === 'class' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Class Type</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={classType}
            onChange={(e) => setClassType(e.target.value)}
          >
            {classTypes.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
          </select>
        </div>
      )}

      {tab === 'exam' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Exam Type</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
          >
            {examTypes.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Lecturer ID (optional)</label>
        <input
          type="text"
          className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
          placeholder="UUID of lecturer"
          value={lecturerId}
          onChange={(e) => setLecturerId(e.target.value)}
        />
      </div>

      {tab === 'exam' && (
        <div>
          <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Invigilators (optional)</label>
          <input
            type="text"
            className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
            placeholder="Comma-separated names"
            value={invigilators}
            onChange={(e) => setInvigilators(e.target.value)}
          />
        </div>
      )}

      <Button type="submit" className="w-full" isLoading={submitting}>
        {isEdit ? 'Update Entry' : 'Create Entry'}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Timetable Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Schedule, manage and publish class and exam timetables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isPublished ? 'success' : 'outline'}
            leftIcon={isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            onClick={() => handlePublish(!isPublished)}
          >
            {isPublished ? 'Published' : 'Publish'}
          </Button>
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => { resetForm(); setCreateOpen(true); }}>
            Add Entry
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <Filter className="w-4 h-4" />
          <span>Level:</span>
          <select
            className="px-2 py-1 text-sm bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All Levels</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" leftIcon={<AlertTriangle className="w-3.5 h-3.5" />} onClick={handleCheckConflicts}>
          Check Conflicts
        </Button>
        <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleBulkDelete}>
          Delete All {tab === 'class' ? 'Class' : 'Exam'}
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'class', label: 'Class Timetable', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'exam', label: 'Exam Timetable', icon: <GraduationCap className="w-4 h-4" /> },
        ]}
        activeTab={tab}
        onChange={(t) => setTab(t as EntryType)}
      />

      {loading ? (
        <Card>
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading timetable...</span>
          </div>
        </Card>
      ) : tab === 'class' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary-500" />
              Weekly Class Schedule
            </CardTitle>
            <CardDescription>
              {entries.length} class entries
              {levelFilter ? ` for Level ${levelFilter}` : ''}
              {isPublished && <Badge variant="success" className="ml-2">Published</Badge>}
            </CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse">
              <thead>
                <tr>
                  <th className="text-[10px] font-medium text-surface-500 text-left w-16">Time</th>
                  {days.map((d) => (
                    <th key={d} className="text-[10px] font-medium text-surface-500 text-center px-2">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => (
                  <tr key={h}>
                    <td className="text-[10px] text-surface-400 py-2 pr-2">{h}:00</td>
                    {days.map((d) => {
                      const slot = getSlotAt(d, h);
                      return (
                        <td key={d} className="border border-surface-100 dark:border-surface-800 p-1 text-center min-h-[40px]">
                          {slot && (
                            <div
                              className={`text-[10px] rounded p-1.5 border cursor-pointer hover:shadow-sm transition-shadow ${colorMap[slot.class_type || 'lecture']}`}
                              onClick={() => openEditModal(slot)}
                              title={`${slot.courseCode} — ${slot.courseTitle}\n${slot.venue}\n${slot.level || ''}L\n${slot.lecturer_name || 'No lecturer'}\n${slot.class_type || 'lecture'}`}
                            >
                              <p className="font-bold">{slot.courseCode}</p>
                              <p className="truncate text-[9px] opacity-75">{slot.venue}</p>
                              {slot.level && <p className="text-[9px] opacity-60">{slot.level}L</p>}
                              {slot.lecturer_name && <p className="text-[9px] truncate opacity-60">{slot.lecturer_name}</p>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary-500" />
              Exam Schedule
            </CardTitle>
            <CardDescription>
              {entries.length} exam entries
              {levelFilter ? ` for Level ${levelFilter}` : ''}
              {isPublished && <Badge variant="success" className="ml-2">Published</Badge>}
            </CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 space-y-3">
            {entries.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-8">No exam entries scheduled</p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => openEditModal(entry)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-primary-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.exam_type === 'carryover' ? 'warning' : 'primary'}>{entry.courseCode}</Badge>
                        <span className="text-xs text-surface-500">{entry.exam_type === 'carryover' ? 'Carryover' : 'Main'}</span>
                      </div>
                      <p className="text-xs font-medium text-surface-700 dark:text-surface-300 mt-0.5">{entry.courseTitle}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-surface-400">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{entry.venue}</span>
                        {entry.level && <span>{entry.level}L</span>}
                        {entry.lecturer_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{entry.lecturer_name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.invigilators && (
                      <span className="text-[10px] text-surface-400 max-w-[120px] truncate">Invig: {entry.invigilators}</span>
                    )}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {showConflicts && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Conflict Detection ({conflictCount})
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowConflicts(false)}>Close</Button>
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-2">
            {conflictCount === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400">No conflicts detected</p>
            ) : (
              conflicts.map((c, i) => (
                <div key={i} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="danger">{c.type.replace('_', ' ')}</Badge>
                    <span className="text-xs text-red-700 dark:text-red-300">{c.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={`Add ${tab === 'class' ? 'Class' : 'Exam'} Entry`}>
        <CourseForm isEdit={false} />
      </Modal>

      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditingEntry(null); }} title={`Edit ${tab === 'class' ? 'Class' : 'Exam'} Entry`}>
        <CourseForm isEdit={true} />
      </Modal>
    </div>
  );
};

export default TimetableManagePage;
