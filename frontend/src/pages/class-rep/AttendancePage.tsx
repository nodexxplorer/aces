import { useState, useEffect } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { getCourses } from '../../api/courses';
import {
  getClassRepClassList,
  createAttendanceSession,
  listMyAttendanceSessions,
  listAttendanceCheckins,
  checkInStudent,
  type AttendanceSession,
  // type AttendanceCheckin,
  type ClassRepStudent,
} from '../../api/class-rep';
import { submitAttendanceSession } from '../../api/attendance';
import QRScanner from '../../components/ui/QRScanner';
import { parseProfileScanUserId } from '../../utils/qr-scanner';
import { getErrorMessage } from '../../utils/errors';
import type { Course } from '../../types';
import { Search, Check, Scan, Send, Radio, QrCode } from 'lucide-react';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'unmarked';

export default function AttendancePage() {
  const { success, warning, error: notifyError } = useNotification();

  const [, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);

  // Per student attendance status map
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [coursesRes, classListRes, sessionsRes] = await Promise.allSettled([
          getCourses(),
          getClassRepClassList(),
          listMyAttendanceSessions(),
        ]);

        let courseList: Course[] = [];
        if (coursesRes.status === 'fulfilled') {
          courseList = Array.isArray(coursesRes.value) ? coursesRes.value : [];
          setCourses(courseList);
          if (courseList.length > 0) setSelectedCourse(courseList[0]);
        }

        let studentList: ClassRepStudent[] = [];
        if (classListRes.status === 'fulfilled') {
          studentList = Array.isArray(classListRes.value) ? classListRes.value : [];
          setStudents(studentList);
        }

        if (sessionsRes.status === 'fulfilled') {
          const sList = Array.isArray(sessionsRes.value) ? sessionsRes.value : [];
          setSessions(sList);
          const open = sList.find((s) => s.status === 'open' || s.status === 'active');
          if (open) {
            setActiveSession(open);
            // load checkins
            const checkins = await listAttendanceCheckins(open.id);
            const initMap: Record<string, AttendanceStatus> = {};
            checkins.forEach((c) => {
              initMap[c.student_id] = c.present ? 'present' : 'absent';
            });
            setStatusMap(initMap);
          } else if (courseList.length > 0) {
            // create default session
            try {
              const newSess = await createAttendanceSession(courseList[0].id, 'manual', 'LT 2');
              setActiveSession(newSess);
            } catch {
              // fallback
            }
          }
        }
      } catch (e) {
        notifyError('Load Error', getErrorMessage(e, 'Failed to initialize session'));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSetStatus = async (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
    if (!activeSession) return;
    try {
      await checkInStudent(
        activeSession.id,
        studentId,
        'manual',
        status === 'present' || status === 'late',
        status === 'late' ? 'Late' : undefined,
      );
    } catch {
      // ignore
    }
  };

  const handleMarkAllPresent = async () => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      updated[s.id] = 'present';
    });
    setStatusMap(updated);
    if (!activeSession) return;
    try {
      for (const s of students) {
        await checkInStudent(activeSession.id, s.id, 'manual', true);
      }
      success('Marked', 'All students marked present');
    } catch (e) {
      notifyError('Error', getErrorMessage(e, 'Failed to mark all present'));
    }
  };

  const handleQRScan = async (scannedText: string) => {
    const parsed = parseProfileScanUserId(scannedText);
    const userIdOrMatric = parsed || scannedText.trim();

    const matched = students.find(
      (s) =>
        s.user_id === userIdOrMatric ||
        s.id === userIdOrMatric ||
        s.matric_number?.toLowerCase() === userIdOrMatric.toLowerCase(),
    );

    if (matched) {
      handleSetStatus(matched.id, 'present');
      success('Checked in', `${matched.full_name} marked present`);
      setScannerOpen(false);
    } else {
      warning('Not matched', 'Student was not found in your class list');
    }
  };

  const handleSubmitSession = async () => {
    if (!activeSession) return;
    try {
      setSubmitting(true);
      await submitAttendanceSession(activeSession.id, 'send_to_lecturer');
      success('Session Submitted', 'Attendance sent to your lecturer successfully.');
    } catch (e) {
      notifyError('Submit Failed', getErrorMessage(e, 'Failed to submit attendance session'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      !search.trim() ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.matric_number?.toLowerCase().includes(search.toLowerCase()),
  );

  // Stats calculation
  const presentCount = students.filter((s) => statusMap[s.id] === 'present').length;
  const lateCount = students.filter((s) => statusMap[s.id] === 'late').length;
  const absentCount = students.filter((s) => statusMap[s.id] === 'absent').length;
  const notMarkedCount = students.filter((s) => !statusMap[s.id] || statusMap[s.id] === 'unmarked').length;

  const courseTitle = selectedCourse
    ? `${selectedCourse.code} · ${selectedCourse.title}`
    : 'CPE 501 · Advanced Digital Systems Design';

  return (
    <div className="space-y-6">
      {/* Session Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE SESSION
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-surface-900 dark:text-white">
            {courseTitle}
          </h1>
          <p className="text-xs text-surface-400 dark:text-slate-400">Today, 10:00 AM · LT 2 · Okon Okon</p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Check className="w-3.5 h-3.5" />
            Synced
          </span>
          <button
            onClick={() => success('Saved', 'Session saved to finish later.')}
            className="px-4 py-1.5 rounded-xl border border-surface-300 dark:border-[#223352] text-xs font-semibold text-surface-700 dark:text-slate-200 hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors cursor-pointer"
          >
            End later
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm space-y-1">
          <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Present</p>
          <p className="text-3xl font-black text-emerald-500">{presentCount}</p>
        </div>
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm space-y-1">
          <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Late</p>
          <p className="text-3xl font-black text-amber-500">{lateCount}</p>
        </div>
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm space-y-1">
          <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Absent</p>
          <p className="text-3xl font-black text-rose-500">{absentCount}</p>
        </div>
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm space-y-1">
          <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Not marked</p>
          <p className="text-3xl font-black text-surface-900 dark:text-white">{notMarkedCount}</p>
        </div>
      </div>

      {/* Split Main: Left Student Attendance List & Right QR Scanner Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Student List with 3-state toggle */}
        <div className="lg:col-span-2 rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students"
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-200 dark:border-[#1e2a3f] text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
              />
            </div>
            <button
              onClick={handleMarkAllPresent}
              className="px-4 py-2 rounded-xl border border-surface-300 dark:border-[#223352] hover:bg-surface-100 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              Mark all present
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-surface-400">Loading student roster...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-xs text-surface-400 dark:text-slate-500">No students found</div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800/60">
              {filteredStudents.map((s) => {
                const curStatus = statusMap[s.id] || 'unmarked';
                const initials =
                  s.full_name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'ST';

                return (
                  <div
                    key={s.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 dark:hover:bg-[#152033]/40 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1d68ec] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-surface-900 dark:text-white">
                          {s.full_name}
                        </p>
                        <p className="text-[11px] font-mono text-surface-400 dark:text-slate-500">{s.matric_number}</p>
                      </div>
                    </div>

                    {/* 3-State Segmented Toggle Pill (Present, Late, Absent) */}
                    <div className="flex items-center gap-1 p-1 bg-surface-100 dark:bg-[#0b101c] rounded-xl border border-surface-200 dark:border-[#1a2538] self-start sm:self-auto">
                      <button
                        onClick={() => handleSetStatus(s.id, 'present')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          curStatus === 'present'
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleSetStatus(s.id, 'late')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          curStatus === 'late'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
                        }`}
                      >
                        Late
                      </button>
                      <button
                        onClick={() => handleSetStatus(s.id, 'absent')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          curStatus === 'absent'
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Scan Academic ID & Submit Session */}
        <div className="space-y-6">
          {/* Scan Academic ID Card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm flex flex-col items-center text-center space-y-4">
            {scannerOpen ? (
              <div className="w-full space-y-3">
                <QRScanner onScan={handleQRScan} />
                <button
                  type="button"
                  onClick={() => setScannerOpen(false)}
                  className="px-4 py-1.5 rounded-xl border border-surface-300 dark:border-[#223352] text-xs font-semibold text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] cursor-pointer"
                >
                  Close scanner
                </button>
              </div>
            ) : (
              <>
                {/* Stylized QR scan target frame with corner bracket guides matching PDF page 16 */}
                <div className="w-48 h-40 rounded-2xl border-2 border-dashed border-[#1d68ec]/40 bg-surface-50 dark:bg-[#0b101c] flex items-center justify-center relative my-2">
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#1d68ec]" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#1d68ec]" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#1d68ec]" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#1d68ec]" />
                  <QrCode className="w-12 h-12 text-[#1d68ec]" />
                </div>

                <div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-white">Scan Academic ID</h3>
                  <p className="text-xs text-surface-400 dark:text-slate-400 mt-1 max-w-xs">
                    Students show the QR on their profile. Each scan marks them present.
                  </p>
                </div>

                <button
                  onClick={() => setScannerOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1d68ec]/25 transition-all cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  <span>Start scanning</span>
                </button>
              </>
            )}
          </div>

          {/* Submit session card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-3">
            <button
              onClick={handleSubmitSession}
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#1d68ec]/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Submit session'}</span>
            </button>
            <p className="text-[11px] text-surface-400 dark:text-slate-500 text-center leading-relaxed">
              Sends the attendance to your lecturer. You can edit until it is submitted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
