import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import QRScanner from '../../components/ui/QRScanner';
import { useNotification } from '../../hooks/useNotification';
import { Check, ClipboardList, Scan } from 'lucide-react';

interface StudentAttendanceRow {
  studentId: string;
  matricNumber: string;
  name: string;
  present: boolean;
}

const mockStudents: StudentAttendanceRow[] = [
  { studentId: 'stud-1', matricNumber: 'ENG/2021/001', name: 'John Doe', present: true },
  { studentId: 'stud-2', matricNumber: 'ENG/2021/002', name: 'Jane Smith', present: true },
  { studentId: 'stud-3', matricNumber: 'ENG/2021/003', name: 'Bob Alabi', present: false },
];

const AttendancePage = () => {
  const { success, warning } = useNotification();
  const [course, setCourse] = useState('cpe511');
  const [students, setStudents] = useState<StudentAttendanceRow[]>(mockStudents);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const togglePresent = (idx: number) => {
    setStudents((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], present: !copy[idx].present };
      return copy;
    });
  };

  const handleQRScan = (dataStr: string) => {
    try {
      const data = JSON.parse(dataStr);
      if (data.userId) {
        setStudents((prev) =>
          prev.map((s) => (s.studentId === data.userId || s.matricNumber === data.matricNumber ? { ...s, present: true } : s))
        );
        success('Marked Present', `Marked attendance for ${data.firstName || 'Student'}`);
        setScannerOpen(false);
      }
    } catch {
      warning('Scan Error', 'Invalid QR payload format.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      success('Attendance Saved', 'Successfully stored class attendance record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Attendance Tracker</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Track daily class lecture attendance manually or via student QR codes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Scan className="w-4 h-4" />} onClick={() => setScannerOpen(true)}>
            QR Scan Intake
          </Button>
          <Button isLoading={saving} onClick={handleSave} leftIcon={<Check className="w-4 h-4" />}>
            Save Record
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Attendance Sheet</CardTitle>
            <CardDescription>Roster checklist for lecture attendance</CardDescription>
          </div>
          <Select
            options={[
              { value: 'cpe511', label: 'CPE 511 (Embedded Systems)' },
              { value: 'cpe513', label: 'CPE 513 (Computer Architecture II)' },
            ]}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Matric Number</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-150 dark:divide-surface-800/80">
              {students.map((row, idx) => (
                <tr key={row.studentId}>
                  <td className="px-6 py-4 font-semibold text-surface-900 dark:text-white">{row.matricNumber}</td>
                  <td className="px-6 py-4 text-surface-700 dark:text-surface-300">{row.name}</td>
                  <td className="px-6 py-2">
                    <button
                      onClick={() => togglePresent(idx)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${row.present ? 'bg-success-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-400'}`}
                    >
                      {row.present ? 'Present' : 'Absent'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6">
            <CardHeader className="mb-4">
              <CardTitle>Scan Academic QR Code</CardTitle>
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
