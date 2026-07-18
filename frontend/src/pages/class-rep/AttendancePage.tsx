import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
// import Badge from '../../components/ui/Badge';
import QRScanner from '../../components/ui/QRScanner';
import { useNotification } from '../../hooks/useNotification';
import { Scan, Lock, Play, Square } from 'lucide-react';
import {
  getClassRepClassList,
  createAttendanceSession,
  openAttendanceSession,
  closeAttendanceSession,
  listMyAttendanceSessions,
  listAttendanceCheckins,
  checkInStudent,
  type ClassRepStudent,
  type AttendanceSession,
  type AttendanceCheckin,
} from '../../api/class-rep';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

const AttendancePage = () => {
  const { success, warning, error: notifyError } = useNotification();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [checkins, setCheckins] = useState<AttendanceCheckin[]>([]);
  const [, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState('manual');
  const [venue, setVenue] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [classList, sessionsList] = await Promise.allSettled([
          getClassRepClassList(),
          listMyAttendanceSessions(),
        ]);
        if (classList.status === 'fulfilled') setStudents(classList.value);
        if (sessionsList.status === 'fulfilled') {
          setSessions(sessionsList.value);
          // Find the most recent open session
          const openSession = sessionsList.value.find((s) => s.status === 'open');
          if (openSession) {
            setActiveSession(openSession);
            // Load checkins for this session
            try {
              const checkinsList = await listAttendanceCheckins(openSession.id);
              setCheckins(checkinsList);
            } catch (e) {
              console.error('Failed to load attendance checkins', e);
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

  const getStudentStatus = (studentId: string): boolean => {
    const checkin = checkins.find((c) => c.student_id === studentId);
    return checkin?.present ?? false;
  };

  const handleTogglePresent = async (studentId: string) => {
    if (!activeSession) return;

    const currentPresent = getStudentStatus(studentId);
    try {
      await checkInStudent(activeSession.id, studentId, 'manual', !currentPresent);
      // Update local state
      setCheckins((prev) => {
        const existing = prev.findIndex((c) => c.student_id === studentId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], present: !currentPresent };
          return updated;
        }
        return [...prev, { student_id: studentId, present: !currentPresent, session_id: activeSession.id, id: '', method: 'manual', checked_in_at: new Date().toISOString(), student_name: '', matric_number: '', remark: '' }];
      });
    } catch (e) {
      notifyError('Check-in Failed', getErrorMessage(e));
    }
  };

  const handleCreateSession = async () => {
    if (!method) {
      warning('Select Method', 'Please select an attendance method');
      return;
    }

    setSaving(true);
    try {
      const session = await createAttendanceSession(
        '00000000-0000-0000-0000-000000000000', // placeholder — would need course selection
        method,
        venue || undefined
      );
      setSessions((prev) => [session, ...prev]);
      success('Session Created', 'Opening attendance session...');
      // Auto-open
      const opened = await openAttendanceSession(session.id);
      setActiveSession(opened);
      setSessions((prev) => prev.map((s) => (s.id === opened.id ? opened : s)));
      success('Session Opened', 'Students can now check in');
    } catch (e) {
      notifyError('Create Failed', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    setSaving(true);
    try {
      const closed = await closeAttendanceSession(activeSession.id);
      setActiveSession(null);
      setSessions((prev) => prev.map((s) => (s.id === closed.id ? closed : s)));
      setCheckins([]);
      success('Session Closed', 'Attendance recording is complete');
    } catch (e) {
      notifyError('Close Failed', getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleQRScan = (dataStr: string) => {
    try {
      const data = JSON.parse(dataStr);
      if (data.userId || data.matricNumber) {
        const student = students.find(
          (s) => s.id === data.userId || s.matric_number === data.matricNumber
        );
        if (student && activeSession) {
          checkInStudent(activeSession.id, student.id, 'qr', true)
            .then(() => {
              setCheckins((prev) => [...prev, { student_id: student.id, present: true, session_id: activeSession.id, id: '', method: 'qr', checked_in_at: new Date().toISOString(), student_name: student.full_name, matric_number: student.matric_number, remark: '' }]);
              success('Marked Present', `QR check-in for ${student.full_name}`);
            })
            .catch((e) => notifyError('Check-in Failed', getErrorMessage(e)));
        }
        setScannerOpen(false);
      }
    } catch {
      warning('Scan Error', 'Invalid QR payload format');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Attendance Tracker</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {activeSession
              ? `Session active — ${activeSession.method} mode · ${checkins.filter((c) => c.present).length}/${students.length} checked in`
              : 'Create a session to start taking attendance'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeSession ? (
            <>
              <Button variant="outline" leftIcon={<Scan className="w-4 h-4" />} onClick={() => setScannerOpen(true)}>
                QR Scan
              </Button>
              <Button variant="danger" isLoading={saving} onClick={handleCloseSession} leftIcon={<Square className="w-4 h-4" />}>
                Close Session
              </Button>
            </>
          ) : (
            <Button isLoading={saving} onClick={handleCreateSession} leftIcon={<Play className="w-4 h-4" />}>
              Start Session
            </Button>
          )}
        </div>
      </div>

      {/* Session Controls (when no active session) */}
      {!activeSession && (
        <Card>
          <CardHeader>
            <CardTitle>Create Attendance Session</CardTitle>
            <CardDescription>Configure and start a new attendance recording session</CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1">Method</label>
              <Select
                options={[
                  { value: 'manual', label: 'Manual Check' },
                  { value: 'qr', label: 'QR Code Scan' },
                  { value: 'digital_sheet', label: 'Digital Sheet' },
                  { value: 'geofence', label: 'Geofence' },
                ]}
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-500 mb-1">Venue (optional)</label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. LT 301"
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-surface-800 dark:border-surface-700"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Active Session Stats */}
      {activeSession && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-surface-900 p-4 rounded-lg border border-surface-200 dark:border-surface-700">
            <p className="text-xs text-surface-500">Method</p>
            <p className="text-lg font-bold text-surface-900 dark:text-white capitalize">{activeSession.method.replace('_', ' ')}</p>
          </div>
          <div className="bg-white dark:bg-surface-900 p-4 rounded-lg border border-surface-200 dark:border-surface-700">
            <p className="text-xs text-surface-500">Present</p>
            <p className="text-lg font-bold text-success-500">{checkins.filter((c) => c.present).length}</p>
          </div>
          <div className="bg-white dark:bg-surface-900 p-4 rounded-lg border border-surface-200 dark:border-surface-700">
            <p className="text-xs text-surface-500">Absent</p>
            <p className="text-lg font-bold text-danger-500">{students.length - checkins.filter((c) => c.present).length}</p>
          </div>
          <div className="bg-white dark:bg-surface-900 p-4 rounded-lg border border-surface-200 dark:border-surface-700">
            <p className="text-xs text-surface-500">Total</p>
            <p className="text-lg font-bold text-surface-900 dark:text-white">{students.length}</p>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Attendance Sheet</CardTitle>
            <CardDescription>
              {activeSession ? 'Toggle student attendance status below' : 'Start a session to enable attendance'}
            </CardDescription>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Matric Number</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-32">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-150 dark:divide-surface-800/80">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-surface-400">
                    No students found in your class list.
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const present = getStudentStatus(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="px-6 py-4 font-semibold text-surface-900 dark:text-white">{s.matric_number}</td>
                      <td className="px-6 py-4 text-surface-700 dark:text-surface-300">{s.full_name}</td>
                      <td className="px-6 py-2">
                        {activeSession ? (
                          <button
                            onClick={() => handleTogglePresent(s.id)}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${present ? 'bg-success-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-400'}`}
                          >
                            {present ? 'Present' : 'Absent'}
                          </button>
                        ) : (
                          <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-400">
                            <Lock className="w-3 h-3 inline mr-1" /> Waiting
                          </span>
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
              Cancel
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
