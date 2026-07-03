import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { calculateGrade } from '../../utils/cgpa';
import { Save, AlertCircle } from 'lucide-react';

interface StudentScoreRow {
  studentId: string;
  matricNumber: string;
  name: string;
  ca: string;
  exam: string;
}

const mockClassList: StudentScoreRow[] = [
  { studentId: 'stud-1', matricNumber: 'ENG/2021/001', name: 'John Doe', ca: '25', exam: '50' },
  { studentId: 'stud-2', matricNumber: 'ENG/2021/002', name: 'Jane Smith', ca: '20', exam: '45' },
  { studentId: 'stud-3', matricNumber: 'ENG/2021/003', name: 'Bob Alabi', ca: '18', exam: '38' },
];

const EnterScoresPage = () => {
  const { success, warning } = useNotification();
  const [course, setCourse] = useState('cpe511');
  const [scores, setScores] = useState<StudentScoreRow[]>(mockClassList);
  const [saving, setSaving] = useState(false);

  const handleScoreChange = (idx: number, field: 'ca' | 'exam', val: string) => {
    // Validate character matches digit
    if (val !== '' && !/^\d+$/.test(val)) return;

    setScores((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSave = async () => {
    // Check constraints
    for (const r of scores) {
      const caVal = parseInt(r.ca || '0');
      const examVal = parseInt(r.exam || '0');
      if (caVal > 30 || examVal > 70) {
        warning('Input Error', `CA score must be <= 30 and Exam score must be <= 70. Check details for ${r.name}.`);
        return;
      }
    }

    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      success('Grades Saved', 'Students academic score registry successfully updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Enter Class Scores</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Input continuous assessments and examination scores directly.
          </p>
        </div>
        <Button isLoading={saving} onClick={handleSave} leftIcon={<Save className="w-4 h-4" />}>
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Score Sheet</CardTitle>
            <CardDescription>Spreadsheet-like interface for grade submissions</CardDescription>
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
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-28">CA (30)</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-28">Exam (70)</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-24">Total</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-24">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-150 dark:divide-surface-800/80">
              {scores.map((row, idx) => {
                const caVal = parseInt(row.ca || '0');
                const examVal = parseInt(row.exam || '0');
                const total = caVal + examVal;
                const isError = caVal > 30 || examVal > 70;
                const grade = calculateGrade(total);

                return (
                  <tr key={row.studentId} className={isError ? 'bg-danger-500/5' : ''}>
                    <td className="px-6 py-4 font-semibold text-surface-900 dark:text-white">{row.matricNumber}</td>
                    <td className="px-6 py-4 text-surface-700 dark:text-surface-300">{row.name}</td>
                    <td className="px-6 py-2">
                      <input
                        type="text"
                        value={row.ca}
                        maxLength={2}
                        onChange={(e) => handleScoreChange(idx, 'ca', e.target.value)}
                        className={`w-20 px-2 py-1 text-sm bg-white dark:bg-surface-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${caVal > 30 ? 'border-danger-500 focus:border-danger-500' : 'border-surface-300 dark:border-surface-600 focus:border-primary-500'}`}
                      />
                    </td>
                    <td className="px-6 py-2">
                      <input
                        type="text"
                        value={row.exam}
                        maxLength={2}
                        onChange={(e) => handleScoreChange(idx, 'exam', e.target.value)}
                        className={`w-20 px-2 py-1 text-sm bg-white dark:bg-surface-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${examVal > 70 ? 'border-danger-500 focus:border-danger-500' : 'border-surface-300 dark:border-surface-600 focus:border-primary-500'}`}
                      />
                    </td>
                    <td className="px-6 py-4 font-bold text-surface-900 dark:text-white">{isError ? '-' : total}</td>
                    <td className="px-6 py-4 font-bold text-primary-500">{isError ? <AlertCircle className="w-5 h-5 text-danger-500" /> : grade}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default EnterScoresPage;
