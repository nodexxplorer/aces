import { useState, useEffect, useRef } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import QRScanner from '../../components/ui/QRScanner';
import { useNotification } from '../../hooks/useNotification';
import {
  Scan,
  Lock,
  Play,
  Square,
  Send,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  getClassRepClassList,
  createAttendanceSession,
  openAttendanceSession,
  closeAttendanceSession,
  listMyAttendanceSessions,
  listAttendanceCheckins,
  checkInStudent,
  type AttendanceSession,
  type AttendanceCheckin,
} from '../../api/class-rep';
import {
  getClassRepTimetable,
  getRegisteredStudentsForAttendance,
  submitAttendanceSession,
  downloadAttendancePDF,
  type TimetableEntry,
  type RegisteredStudentAttendance,
} from '../../api/attendance';
import { getCourses } from '../../api/courses';
import type { Course } from '../../types';
import { parseProfileScanUserId } from '../../utils/qr-scanner';
import { getErrorMessage } from '../../utils/errors';

type StatusType = 'present' | 'absent' | 'late' | 'excused';

const AttendancePage = () => {
  const { success, warning, error: notifyError } = useNotification();
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [students, setStudents] = useState<RegisteredStudentAttendance[]>([]);
  const [checkins, setCheckins] = useState<AttendanceCheckin[]>([]);
  const [, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [displayQrOpen, setDisplayQrOpen] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusType>('all');
  const [method, setMethod] = useState('manual');
  const [venue, setVenue] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [ttRes, coursesRes, sessionsList] = await Promise.allSettled([
          getClassRepTimetable(),
          getCourses(),
          listMyAttendanceSessions(),
        ]);

        let level = 400;
        let entries: TimetableEntry[] = [];
        if (ttRes.status === 'fulfilled') {
          if (ttRes.value.level) {
            level = ttRes.value.level;
          }
          if (ttRes.value.entries?.length > 0) {
            entries = ttRes.value.entries;
          }
        }

        if (entries.length === 0 && coursesRes.status === 'fulfilled' && coursesRes.value.length > 0) {
          const levelCourses = coursesRes.value.filter((c: Course) => c.level === level);
          const sourceCourses = levelCourses.length > 0 ? levelCourses : coursesRes.value;

          entries = sourceCourses.map((c: Course) => ({
            timetable_entry_id: c.id,
            course_id: c.id,
            course_code: c.code,
            course_title: c.title,
            lecturer_name: 'Department Lecturer',
            venue: 'Main Hall',
            day_of_week: 'Semester Course',
            start_time: '08:00',
            end_time: '10:00',
            card_status: 'upcoming',
          }));
        }

        setTimetable(entries);
        if (entries.length > 0) {
          setSelectedCourseId(entries[0].course_id);
        }

        if (sessionsList.status === 'fulfilled') {
          setSessions(sessionsList.value);
          const openSession = sessionsList.value.find((s) => s.status === 'open' || s.status === 'active');
          if (openSession) {
            setActiveSession(openSession);
            try {
              const checkinsList = await listAttendanceCheckins(openSession.id);
              setCheckins(checkinsList);
            } catch (e) {
              console.error('Failed to load checkins', e);
            }
          }
        }
      } catch (e) {
        notifyError('Load Error', getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [notifyError]);

  // Load registered students for the selected course
  useEffect(() => {
    if (!selectedCourseId) return;
    const fetchRegistered = async () => {
      try {
        const res = await getRegisteredStudentsForAttendance(selectedCourseId);
        if (res.students && res.students.length > 0) {
          setStudents(res.students);
          return;
        }
      } catch (e) {
        console.error('Failed to fetch registered students', e);
      }
      try {
        const list = await getClassRepClassList();
        setStudents(
          list.map((s) => ({
            student_id: s.id,
            user_id: s.user_id || s.id,
            matric_number: s.matric_number,
            full_name: s.full_name,
            level: s.level,
            registration_status: 'verified',
            registered_at: new Date().toISOString(),
          })),
        );
      } catch (e) {
        console.error('Failed to load class list fallback', e);
      }
    };
    fetchRegistered();
  }, [selectedCourseId]);

  // Render the self-check-in QR whenever the display modal opens. It encodes
  // a plain URL (not JSON) so a student's stock phone camera can open it
  // directly, landing on the in-app scan-to-check-in page.
  useEffect(() => {
    if (displayQrOpen && activeSession && qrCanvasRef.current) {
      const checkinUrl = `${window.location.origin}/attendance/checkin?session=${activeSession.id}`;
      QRCode.toCanvas(qrCanvasRef.current, checkinUrl, {
        width: 220,
        margin: 2,
        color: { dark: '#2563eb', light: '#ffffff' },
      });
    }
  }, [displayQrOpen, activeSession]);

  // Poll for new self-check-ins while the QR is on display, since students
  // scanning it check in from their own device, not this one.
  useEffect(() => {
    if (!displayQrOpen || !activeSession) return;
    const interval = setInterval(() => {
      listAttendanceCheckins(activeSession.id)
        .then(setCheckins)
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [displayQrOpen, activeSession]);

  const handleDownloadQr = () => {
    if (!qrCanvasRef.current || !activeSession) return;
    const link = document.createElement('a');
    link.download = `attendance-checkin-qr-${activeSession.id}.png`;
    link.href = qrCanvasRef.current.toDataURL('image/png');
    link.click();
  };

  const getStudentStatus = (studentId: string): StatusType => {
    const checkin = checkins.find((c) => c.student_id === studentId);
    if (!checkin) return 'absent';
    if (checkin.remark === 'late') return 'late';
    if (checkin.remark === 'excused') return 'excused';
    return checkin.present ? 'present' : 'absent';
  };

  const handleUpdateStatus = async (studentId: string, newStatus: StatusType) => {
    if (!activeSession) return;
    try {
      const isPresent = newStatus === 'present' || newStatus === 'late';
      await checkInStudent(activeSession.id, studentId, method, isPresent);

      setCheckins((prev) => {
        const existing = prev.findIndex((c) => c.student_id === studentId);
        const entry: AttendanceCheckin = {
          id: existing >= 0 ? prev[existing].id : '',
          session_id: activeSession.id,
          student_id: studentId,
          student_name: '',
          matric_number: '',
          present: isPresent,
          method: method,
          checked_in_at: new Date().toISOString(),
          remark: newStatus,
        };
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = entry;
          return updated;
        }
        return [...prev, entry];
      });
    } catch (e) {
      notifyError('Status Update Failed', getErrorMessage(e));
    }
  };

  const handleQRScan = async (data: string) => {
    if (!activeSession) return;
    const scannedUserId = parseProfileScanUserId(data);
    if (!scannedUserId) {
      notifyError('Invalid QR Code', 'This does not look like a student ID QR code.');
      return;
    }
    const match = students.find((s) => s.user_id === scannedUserId);
    if (!match) {
      notifyError('Not Found', 'This student is not on the registered roster for this course.');
      return;
    }
    await handleUpdateStatus(match.user_id, 'present');
    success('Checked In', `${match.full_name} marked present.`);
  };

  const handleMarkAll = async (targetStatus: StatusType) => {
    if (!activeSession) return;
    setSaving(true);
    try {
      for (const s of filteredStudents) {
        await handleUpdateStatus(s.user_id, targetStatus);
      }
      success('Bulk Update', `All visible students marked as ${targetStatus}`);
    } catch (e) {
      notifyError('Bulk Update Error', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedCourseId) {
      warning('Select Course', 'Please select a course to start attendance');
      return;
    }
    setSaving(true);
    try {
      const session = await createAttendanceSession(selectedCourseId, method, venue || undefined);
      setSessions((prev) => [session, ...prev]);
      const opened = await openAttendanceSession(session.id);
      setActiveSession(opened);
      success('Session Opened', 'Registered students can now be marked.');
    } catch (e) {
      notifyError('Create Failed', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    setFinalizeModalOpen(true);
  };

  const handleSendToLecturer = async () => {
    if (!activeSession) return;
    setSaving(true);
    try {
      await submitAttendanceSession(activeSession.id, 'send_to_lecturer');
      await closeAttendanceSession(activeSession.id);
      setActiveSession(null);
      setCheckins([]);
      setFinalizeModalOpen(false);
      success('Submitted to Lecturer', 'Attendance sent to Lecturer dashboard for review.');
    } catch (e) {
      notifyError('Submission Failed', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!activeSession) return;
    downloadAttendancePDF(activeSession.id);
    await closeAttendanceSession(activeSession.id);
    setActiveSession(null);
    setCheckins([]);
    setFinalizeModalOpen(false);
    success('PDF Downloaded', 'Attendance sheet saved as branded PDF.');
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.matric_number.toLowerCase().includes(searchQuery.toLowerCase());
    const currentSt = getStudentStatus(s.user_id);
    const matchesStatus = statusFilter === 'all' || currentSt === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const presentCount = students.filter((s) => getStudentStatus(s.user_id) === 'present').length;
  const lateCount = students.filter((s) => getStudentStatus(s.user_id) === 'late').length;
  const excusedCount = students.filter((s) => getStudentStatus(s.user_id) === 'excused').length;
  const absentCount = students.length - (presentCount + lateCount + excusedCount);
  const attendanceRate = students.length > 0 ? Math.round(((presentCount + lateCount) / students.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Class Rep Attendance Hub</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {activeSession
              ? `Session Active · ${attendanceRate}% Present (${presentCount}/${students.length} students)`
              : 'Select a course from your semester timetable to initiate attendance.'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeSession ? (
            <>
              <Button variant="outline" leftIcon={<Scan className="w-4 h-4" />} onClick={() => setScannerOpen(true)}>
                QR Scan
              </Button>
              <Button
                variant="outline"
                leftIcon={<QrCode className="w-4 h-4" />}
                onClick={() => setDisplayQrOpen(true)}
              >
                Display QR
              </Button>
              <Button
                variant="danger"
                isLoading={saving}
                onClick={handleCloseSession}
                leftIcon={<Square className="w-4 h-4" />}
              >
                Finalize Session
              </Button>
            </>
          ) : (
            <Button isLoading={saving} onClick={handleCreateSession} leftIcon={<Play className="w-4 h-4" />}>
              Start Attendance Session
            </Button>
          )}
        </div>
      </div>

      {/* Timetable Course Selector */}
      {!activeSession && (
        <Card className="p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle>Semester Course Schedule</CardTitle>
            <CardDescription>
              Only students with verified course registrations will be loaded into attendance.
            </CardDescription>
          </CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1">Select Course</label>
              <Select
                options={timetable.map((t) => ({
                  value: t.course_id,
                  label: `${t.course_code} - ${t.course_title} (${t.day_of_week} ${t.start_time})`,
                }))}
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1">Attendance Method</label>
              <Select
                options={[
                  { value: 'manual', label: 'Manual Roster Check' },
                  { value: 'qr', label: 'Student QR Scan' },
                  { value: 'digital_sheet', label: 'Digital Sign Sheet' },
                ]}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1">Venue / Lecture Room</label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. LT 301 / ETF Lab"
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-surface-800 dark:border-surface-700"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards & Real-Time Progress */}
      {activeSession && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
              <p className="text-xs text-surface-500">Registered</p>
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{students.length}</p>
            </div>
            <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
              <p className="text-xs text-surface-500">Present</p>
              <p className="text-2xl font-bold text-success-600">{presentCount}</p>
            </div>
            <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
              <p className="text-xs text-surface-500">Absent</p>
              <p className="text-2xl font-bold text-danger-600">{absentCount}</p>
            </div>
            <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
              <p className="text-xs text-surface-500">Late</p>
              <p className="text-2xl font-bold text-yellow-600">{lateCount}</p>
            </div>
            <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
              <p className="text-xs text-surface-500">Rate</p>
              <p className="text-2xl font-bold text-primary-600">{attendanceRate}%</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-surface-200 dark:bg-surface-800 h-2.5 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${(presentCount / (students.length || 1)) * 100}%` }}
              className="bg-success-500 h-full transition-all"
            />
            <div
              style={{ width: `${(lateCount / (students.length || 1)) * 100}%` }}
              className="bg-yellow-500 h-full transition-all"
            />
            <div
              style={{ width: `${(excusedCount / (students.length || 1)) * 100}%` }}
              className="bg-blue-500 h-full transition-all"
            />
          </div>
        </div>
      )}

      {/* Roster & Filtering Controls */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Verified Course Roster ({students.length})</CardTitle>
            <CardDescription>Only students with active registration records appear here.</CardDescription>
          </div>
          {activeSession && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => handleMarkAll('present')}>
                Mark All Present
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleMarkAll('absent')}>
                Mark All Absent
              </Button>
            </div>
          )}
        </CardHeader>

        {/* Filter bar */}
        <div className="p-4 pt-0 flex flex-col md:flex-row gap-3 items-center justify-between border-b border-surface-150 dark:border-surface-800">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search student or matric..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg dark:bg-surface-800 dark:border-surface-700"
            />
          </div>

          <div className="flex gap-1 w-full md:w-auto overflow-x-auto">
            {(['all', 'present', 'absent', 'late', 'excused'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-surface-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">S/N</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Matric Number</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Student Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Level</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-surface-500 uppercase">
                  Attendance Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-150 dark:divide-surface-800/80">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-surface-400">
                    No verified students match your query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const currentSt = getStudentStatus(s.user_id);
                  return (
                    <tr key={s.student_id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/30">
                      <td className="px-6 py-4 text-surface-400 text-xs">{idx + 1}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-surface-900 dark:text-white">
                        {s.matric_number}
                      </td>
                      <td className="px-6 py-4 font-medium text-surface-800 dark:text-surface-200">{s.full_name}</td>
                      <td className="px-6 py-4 text-surface-500">{s.level}L</td>
                      <td className="px-6 py-2 text-center">
                        {activeSession ? (
                          <div className="inline-flex rounded-lg border border-surface-200 dark:border-surface-700 p-0.5 bg-surface-50 dark:bg-surface-800">
                            <button
                              onClick={() => handleUpdateStatus(s.user_id, 'present')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                                currentSt === 'present'
                                  ? 'bg-success-500 text-white shadow-sm'
                                  : 'text-surface-500 hover:text-surface-900'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">Present</span>
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(s.user_id, 'absent')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                                currentSt === 'absent'
                                  ? 'bg-danger-500 text-white shadow-sm'
                                  : 'text-surface-500 hover:text-surface-900'
                              }`}
                            >
                              <XCircle className="w-3 h-3" /> <span className="hidden sm:inline">Absent</span>
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(s.user_id, 'late')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                                currentSt === 'late'
                                  ? 'bg-yellow-500 text-white shadow-sm'
                                  : 'text-surface-500 hover:text-surface-900'
                              }`}
                            >
                              <Clock className="w-3 h-3" /> <span className="hidden sm:inline">Late</span>
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(s.user_id, 'excused')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-all ${
                                currentSt === 'excused'
                                  ? 'bg-blue-500 text-white shadow-sm'
                                  : 'text-surface-500 hover:text-surface-900'
                              }`}
                            >
                              <AlertCircle className="w-3 h-3" /> <span className="hidden sm:inline">Excused</span>
                            </button>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Waiting
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6">
            <CardHeader className="mb-4">
              <CardTitle>Scan Student QR Code</CardTitle>
            </CardHeader>
            <QRScanner onScan={handleQRScan} />
            <Button variant="outline" className="w-full mt-4" onClick={() => setScannerOpen(false)}>
              Close Scanner
            </Button>
          </Card>
        </div>
      )}

      {/* Display QR Modal — students scan this with their own phone to self-check-in */}
      {displayQrOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6 flex flex-col items-center text-center">
            <CardHeader className="mb-4 p-0">
              <CardTitle>Scan to Check In</CardTitle>
              <CardDescription>
                Students scan this with their own phone camera to mark themselves present.
              </CardDescription>
            </CardHeader>
            <canvas ref={qrCanvasRef} className="rounded-2xl" />
            <p className="text-sm text-surface-500 mt-4">
              {presentCount} of {students.length} students checked in
            </p>
            <div className="flex gap-2 w-full mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDownloadQr}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download
              </Button>
              <Button className="flex-1" onClick={() => setDisplayQrOpen(false)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Finalize Modal (Send to Lecturer vs Print PDF) */}
      {finalizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-xl">Finalize Attendance Recording</CardTitle>
              <CardDescription>Choose how to complete this session per ACES Zone specifications.</CardDescription>
            </CardHeader>

            <div className="space-y-3 py-2">
              <button
                onClick={handleSendToLecturer}
                className="w-full p-4 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20 hover:border-primary-500 text-left transition-all flex items-start gap-3"
              >
                <Send className="w-6 h-6 text-primary-600 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-surface-900 dark:text-white">Send to Lecturer Dashboard</h4>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Submits this sheet directly to the assigned lecturer's dashboard for verification and approval.
                  </p>
                </div>
              </button>

              <button
                onClick={handleDownloadPDF}
                className="w-full p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/40 hover:border-surface-400 text-left transition-all flex items-start gap-3"
              >
                <Download className="w-6 h-6 text-surface-700 dark:text-surface-300 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-surface-900 dark:text-white">Print Branded PDF</h4>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Generates an official ACES Zone departmental attendance sheet PDF ready for printing and physical
                    signing.
                  </p>
                </div>
              </button>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setFinalizeModalOpen(false)}>
              Cancel
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
