import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import { getTimetable } from '../../api/timetable';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Download, MapPin, User, Clock, BookOpen, GraduationCap } from 'lucide-react';
import type { TimetableEntry, EntryType } from '../../types';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const numToDay: Record<number, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
const hours = Array.from({ length: 14 }, (_, i) => i + 7);

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

const colorMap: Record<string, string> = {
  lecture: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  lab: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
  tutorial: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
  seminar: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
};

const TimetablePage = () => {
  const { error: notifyError } = useNotification();
  const { user } = useAuth();
  const [tab, setTab] = useState<EntryType>('class');
  const [slots, setSlots] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const studentLevel = (user as any)?.level;

  useEffect(() => {
    setLoading(true);
    const params: Record<string, any> = { entryType: tab };
    if (studentLevel) params.level = studentLevel;
    getTimetable(params as any)
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load timetable'))
      .finally(() => setLoading(false));
  }, [tab, studentLevel]);

  const getSlotAt = (day: string, hour: number) => {
    return slots.find((s) => {
      const dayNum = s.day_of_week;
      if (!dayNum) return false;
      if (numToDay[dayNum] !== day) return false;
      const sh = extractHour(s.start_time);
      const eh = extractHour(s.end_time);
      return hour >= sh && hour < eh;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Timetable</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {studentLevel ? `Showing schedules for Level ${studentLevel}` : 'Class lecture schedules and exam timetable'}
          </p>
        </div>
        <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={() => window.print()}>
          Print Schedule
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

      {tab === 'class' ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {days.map((day) => {
            const daySlots = slots.filter((s) => {
              const dayNum = s.day_of_week;
              if (!dayNum) return false;
              return numToDay[dayNum] === day;
            });
            return (
              <Card key={day} className="flex flex-col">
                <CardHeader className="border-b border-surface-150 dark:border-surface-800 pb-3 mb-3">
                  <CardTitle className="text-base font-bold text-primary-500">{day}</CardTitle>
                </CardHeader>
                <div className="flex-1 space-y-3">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-surface-400 text-center py-6">
                      {loading ? 'Loading...' : 'No scheduled classes'}
                    </p>
                  ) : (
                    daySlots.map((s) => (
                      <div
                        key={s.id}
                        className={`p-3 rounded-xl border ${colorMap[s.class_type || 'lecture']}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge variant="primary">{s.courseCode || 'N/A'}</Badge>
                          {s.class_type && (
                            <span className="text-[9px] uppercase tracking-wider opacity-60">{s.class_type}</span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-surface-800 dark:text-surface-200 line-clamp-1 mb-2">
                          {s.courseTitle || 'Course'}
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatTime(s.start_time)} – {formatTime(s.end_time)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{s.venue}</span>
                          </div>
                          {s.lecturer_name && (
                            <div className="flex items-center gap-1.5 text-[10px] text-surface-500">
                              <User className="w-3.5 h-3.5 shrink-0" />
                              <span>{s.lecturer_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <div className="flex items-center justify-center p-12">
                <span className="text-sm text-surface-500">Loading exam schedule...</span>
              </div>
            </Card>
          ) : slots.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <GraduationCap className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                <p className="text-sm text-surface-500">No exams scheduled yet</p>
              </div>
            </Card>
          ) : (
            slots.map((entry) => (
              <Card key={entry.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-6 h-6 text-primary-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.exam_type === 'carryover' ? 'warning' : 'primary'}>
                          {entry.courseCode}
                        </Badge>
                        <span className="text-xs text-surface-500">{entry.exam_type === 'carryover' ? 'Carryover' : 'Main Exam'}</span>
                      </div>
                      <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mt-1">
                        {entry.courseTitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-surface-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatTime(entry.start_time)} – {formatTime(entry.end_time)}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{entry.venue}</span>
                        {entry.level && <span>{entry.level} Level</span>}
                        {entry.lecturer_name && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{entry.lecturer_name}</span>}
                      </div>
                      {entry.invigilators && (
                        <p className="text-[10px] text-surface-400 mt-2">Invigilators: {entry.invigilators}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TimetablePage;
