import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { FileSpreadsheet, Upload, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listLecturerAssignments, type LecturerAssignment } from '../../api/lecturers';
import { getErrorMessage } from '../../utils/errors';

// Some lecturer-assignment responses attach a semester identifier under
// either naming convention even though the shared `LecturerAssignment` type
// doesn't declare it; this keeps that defensive lookup type-safe.
type LecturerAssignmentWithSemesterId = LecturerAssignment & { semester_id?: string; semesterId?: string };

interface PreviewRow {
  matricNumber: string;
  name: string;
  ca: number;
  exam: number;
  error?: string;
}

const BulkUploadPage = () => {
  const { success, error } = useNotification();
  const [course, setCourse] = useState('cpe511');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [committing, setCommitting] = useState(false);

  const { user } = useAuth();
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    listLecturerAssignments(user.id)
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setAssignments(arr);
        if (arr.length > 0) setCourse(arr[0].course_id);
      })
      .catch(() => {});
  }, [user?.id]);

  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Matric Number,Name,CA (Max 30),Exam (Max 70)\nENG/2021/001,John Doe,28,52\nENG/2021/002,Jane Smith,22,48';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `grade_template_${course}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Template Downloaded', 'CSV grading template downloaded successfully.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text
        .trim()
        .split('\n')
        .filter((l) => l.trim());
      if (lines.length < 2) {
        error('Invalid CSV', 'CSV file is empty or missing data rows.');
        return;
      }
      const header = lines[0]
        .toLowerCase()
        .split(',')
        .map((h) => h.trim());
      const matricIdx = header.findIndex((h) => h.includes('matric'));
      const nameIdx = header.findIndex((h) => h.includes('name'));
      const caIdx = header.findIndex((h) => h.includes('ca'));
      const examIdx = header.findIndex((h) => h.includes('exam'));

      if (matricIdx === -1 || caIdx === -1 || examIdx === -1) {
        error('Invalid CSV Headers', 'Headers must include Matric Number, CA, and Exam columns.');
        return;
      }

      const rows: PreviewRow[] = lines.slice(1).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        const matricNumber = cols[matricIdx] || '';
        const name = nameIdx !== -1 ? cols[nameIdx] : '—';
        const ca = parseFloat(cols[caIdx] || '0');
        const exam = parseFloat(cols[examIdx] || '0');

        let err: string | undefined;
        if (!matricNumber) err = 'Missing Matric Number';
        else if (isNaN(ca) || ca < 0 || ca > 30) err = 'CA score must be 0–30';
        else if (isNaN(exam) || exam < 0 || exam > 70) err = 'Exam score must be 0–70';
        else if (ca + exam > 100) err = 'Total score exceeds 100';

        return { matricNumber, name, ca: isNaN(ca) ? 0 : ca, exam: isNaN(exam) ? 0 : exam, error: err };
      });

      setPreviewData(rows);
      success('File Parsed', `Found ${rows.length} grade records.`);
    };
    reader.readAsText(selected);
  };

  const handleCommit = async () => {
    const hasErrors = previewData.some((r) => r.error);
    if (hasErrors) {
      error('Commit Blocked', 'Please correct all grading sheet row errors before saving.');
      return;
    }

    const selAssign = assignments.find((a) => a.course_id === course);
    if (!selAssign) {
      error('Missing Course', 'Select an assigned course.');
      return;
    }

    setCommitting(true);
    let successCount = 0;
    try {
      const { enterScore } = await import('../../api/results');
      for (const row of previewData) {
        await enterScore({
          courseId: selAssign.course_id,
          sessionId: selAssign.session_id,
          semesterId:
            (selAssign as LecturerAssignmentWithSemesterId).semester_id ||
            (selAssign as LecturerAssignmentWithSemesterId).semesterId ||
            '',
          caScore: row.ca,
          examScore: row.exam,
          matricNumber: row.matricNumber,
        });
        successCount++;
      }
      success('Grades Committed', `Successfully uploaded ${successCount} grade records.`);
      setFile(null);
      setPreviewData([]);
    } catch (err: unknown) {
      error('Upload Error', getErrorMessage(err, 'Failed to submit some grades'));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Bulk Upload Grades</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Import continuous assessment and examination grades using Excel or CSV sheets.
          </p>
        </div>
        <Button variant="outline" leftIcon={<FileSpreadsheet className="w-4 h-4" />} onClick={handleDownloadTemplate}>
          Download CSV Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Settings</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-4">
              <Select
                label="Module Course Code"
                options={assignments.map((a) => ({
                  value: a.course_id,
                  label: `${a.course_code} — ${a.course_title}${a.semester ? ` (${a.semester.toUpperCase()})` : ''}`,
                }))}
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Upload CSV Sheet</label>
                <div className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-6 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-colors relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-surface-400 mx-auto mb-2" />
                  <p className="text-xs text-surface-600 dark:text-surface-300 font-semibold">
                    {file ? file.name : 'Click to select CSV'}
                  </p>
                  <p className="text-[10px] text-surface-400 mt-1">Supported: CSV formats up to 5MB</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {previewData.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Parse Preview</CardTitle>
                  <CardDescription>Review imported grades before committing to ledger</CardDescription>
                </div>
                <Button isLoading={committing} onClick={handleCommit} leftIcon={<Check className="w-4 h-4" />}>
                  Save Grades
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">
                        Matric Number
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-20">
                        CA (30)
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-20">
                        Exam (70)
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-150 dark:divide-surface-800/80">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className={row.error ? 'bg-danger-500/5' : ''}>
                        <td className="px-6 py-4 font-semibold text-surface-900 dark:text-white">{row.matricNumber}</td>
                        <td className="px-6 py-4 text-surface-700 dark:text-surface-300">{row.name}</td>
                        <td className="px-6 py-4">{row.ca}</td>
                        <td className="px-6 py-4">{row.exam}</td>
                        <td className="px-6 py-4 text-xs font-semibold">
                          {row.error ? (
                            <span className="flex items-center gap-1 text-danger-500">
                              <AlertCircle className="w-3.5 h-3.5" /> {row.error}
                            </span>
                          ) : (
                            <span className="text-emerald-500">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadPage;
