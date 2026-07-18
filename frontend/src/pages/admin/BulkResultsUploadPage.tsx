import { useState, useEffect, useRef, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, Trash2, Send } from 'lucide-react';
import { getCourses } from '../../api/courses';
import { getSessions } from '../../api/sessions';
import { getStudents } from '../../api/users';
import { enterScore, getAllResults } from '../../api/results';
import type { Course, Session } from '../../types';

interface CsvRow {
  matric_number: string;
  course_code: string;
  ca_score: string;
  exam_score: string;
}

interface ValidatedRow extends CsvRow {
  status: 'valid' | 'invalid' | 'duplicate';
  errors: string[];
  studentId?: string;
  courseId?: string;
  studentName?: string;
  courseTitle?: string;
}

const BulkResultsUploadPage = () => {
  const { success, error: notifyError } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('harmattan');
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [existingResults, setExistingResults] = useState<any[]>([]);
  const [rawRows, setRawRows] = useState<CsvRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ done: 0, total: 0 });

  const fetchMetadata = useCallback(async () => {
    try {
      setLoadingMeta(true);
      const [sess, crs, stu] = await Promise.all([
        getSessions().catch(() => []),
        getCourses().catch(() => []),
        getStudents({ perPage: 2000 }).catch(() => []),
      ]);
      setSessions(Array.isArray(sess) ? sess : []);
      setCourses(Array.isArray(crs) ? crs : []);
      setStudents(Array.isArray(stu) ? stu : []);
    } catch {
      // silent
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (selectedSession && selectedSemester) {
      getAllResults({ limit: 5000, offset: 0 }).then((res) => {
        const items = Array.isArray(res) ? res : [];
        setExistingResults(items.filter((r: any) => r.session_id === selectedSession || r.sessionId === selectedSession));
      }).catch(() => {});
    }
  }, [selectedSession, selectedSemester]);

  const downloadTemplate = () => {
    const header = 'matric_number,course_code,ca_score,exam_score';
    const example = 'CPE/2020/001,CPE301,25,55';
    const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_results_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): CsvRow[] => {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const matricIdx = header.findIndex((h) => h.includes('matric'));
    const courseIdx = header.findIndex((h) => h.includes('course') && h.includes('code'));
    const caIdx = header.findIndex((h) => h.includes('ca'));
    const examIdx = header.findIndex((h) => h.includes('exam'));

    if (matricIdx === -1 || courseIdx === -1 || caIdx === -1 || examIdx === -1) {
      return [];
    }

    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      return {
        matric_number: cols[matricIdx] || '',
        course_code: cols[courseIdx] || '',
        ca_score: cols[caIdx] || '',
        exam_score: cols[examIdx] || '',
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setRawRows(rows);
      validateRows(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const validateRows = (rows: CsvRow[]) => {
    const seen = new Set<string>();
    const validated: ValidatedRow[] = rows.map((row) => {
      const errors: string[] = [];
      let studentId: string | undefined;
      let courseId: string | undefined;
      let studentName: string | undefined;
      let courseTitle: string | undefined;

      const ca = parseFloat(row.ca_score);
      const exam = parseFloat(row.exam_score);
      if (isNaN(ca) || ca < 0 || ca > 40) errors.push('CA score must be 0–40');
      if (isNaN(exam) || exam < 0 || exam <= 0 || exam > 60) errors.push('Exam score must be 1–60');

      const student = students.find((s: any) =>
        (s.matric_number || s.matricNumber || '').toLowerCase() === row.matric_number.toLowerCase()
      );
      if (!student) {
        errors.push('Student not found');
      } else {
        studentId = student.id;
        studentName = student.full_name || student.fullName || student.email;
      }

      const course = courses.find((c: any) =>
        (c.code || '').toLowerCase() === row.course_code.toLowerCase()
      );
      if (!course) {
        errors.push('Course not found');
      } else {
        courseId = course.id;
        courseTitle = course.title;
      }

      const key = `${studentId || row.matric_number}_${courseId || row.course_code}`.toLowerCase();
      let isDuplicate = false;
      if (existingResults.some((r: any) => {
        const rSid = r.student_id || r.studentId;
        const rCid = r.course_id || r.courseId;
        return rSid === studentId && rCid === courseId;
      })) {
        errors.push('Result already exists for this student/course');
        isDuplicate = true;
      }

      if (seen.has(key) && !isDuplicate) {
        errors.push('Duplicate row in CSV');
        isDuplicate = true;
      }
      seen.add(key);

      const valid = errors.length === 0;
      return {
        ...row,
        status: isDuplicate ? 'duplicate' : valid ? 'valid' : 'invalid',
        errors,
        studentId,
        courseId,
        studentName,
        courseTitle,
      };
    });

    setValidatedRows(validated);
  };

  useEffect(() => {
    if (rawRows.length > 0) validateRows(rawRows);
  }, [students, courses, existingResults]);

  const handleSubmit = async () => {
    if (!selectedSession) {
      notifyError('Missing Session', 'Please select an academic session');
      return;
    }
    const validRows = validatedRows.filter((r) => r.status === 'valid');
    if (validRows.length === 0) {
      notifyError('No Valid Rows', 'There are no valid rows to upload');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitProgress({ done: 0, total: validRows.length });
      let failed = 0;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          await enterScore({
            studentId: row.studentId!,
            courseId: row.courseId!,
            sessionId: selectedSession,
            semester: selectedSemester,
            caScore: parseFloat(row.ca_score),
            examScore: parseFloat(row.exam_score),
          });
        } catch {
          failed++;
        }
        setSubmitProgress({ done: i + 1, total: validRows.length });
      }

      if (failed === 0) {
        success('Upload Complete', `${validRows.length} results uploaded successfully`);
        setValidatedRows([]);
        setRawRows([]);
      } else {
        notifyError('Partial Upload', `${validRows.length - failed} succeeded, ${failed} failed`);
      }
    } catch (err: any) {
      notifyError('Upload Failed', err?.message || 'Could not upload results');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setRawRows([]);
    setValidatedRows([]);
  };

  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const invalidCount = validatedRows.filter((r) => r.status === 'invalid').length;
  const duplicateCount = validatedRows.filter((r) => r.status === 'duplicate').length;

  const columns = [
    {
      key: 'matric_number',
      label: 'Matric Number',
      render: (_: unknown, row: any) => <span className="font-mono text-xs">{row.matric_number}</span>,
    },
    {
      key: 'course',
      label: 'Course',
      render: (_: unknown, row: any) => (
        <div>
          <p className="font-semibold text-xs">{row.course_code}</p>
          <p className="text-[10px] text-surface-500">{row.courseTitle || ''}</p>
        </div>
      ),
    },
    {
      key: 'studentName',
      label: 'Student',
      render: (_: unknown, row: any) => <span className="text-xs">{row.studentName || '—'}</span>,
    },
    {
      key: 'scores',
      label: 'CA / Exam',
      render: (_: unknown, row: any) => (
        <span className="text-xs font-mono">{row.ca_score} / {row.exam_score}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: unknown, row: any) => {
        const color = row.status === 'valid' ? 'text-success-600 bg-success-50' : row.status === 'duplicate' ? 'text-warning-600 bg-warning-50' : 'text-danger-600 bg-danger-50';
        const Icon = row.status === 'valid' ? CheckCircle2 : row.status === 'duplicate' ? AlertTriangle : XCircle;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
            <Icon className="w-3 h-3" />
            {row.status}
          </span>
        );
      },
    },
    {
      key: 'errors',
      label: 'Issues',
      render: (_: unknown, row: any) => (
        <div className="text-[10px] text-danger-500 space-y-0.5">
          {row.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Bulk Results Upload</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Upload course results in bulk using a CSV file. Download the template, fill in scores, and upload.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-500" />
            Upload Configuration
          </CardTitle>
          <CardDescription>Select session, semester, then upload your CSV</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Academic Session"
              options={sessions.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              placeholder={loadingMeta ? 'Loading...' : 'Select session'}
            />
            <Select
              label="Semester"
              options={[
                { value: 'harmattan', label: 'Harmattan (First Semester)' },
                { value: 'rain', label: 'Rain (Second Semester)' },
              ]}
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={downloadTemplate}>
              Download CSV Template
            </Button>
            <Button variant="outline" leftIcon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>
              Upload CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </div>

          {loadingMeta && (
            <p className="text-xs text-surface-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading students and courses...
            </p>
          )}

          <div className="text-xs text-surface-500">
            Students loaded: {students.length} | Courses loaded: {courses.length}
          </div>
        </div>
      </Card>

      {validatedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Validation Preview</span>
              <div className="flex gap-3 text-xs">
                <span className="text-success-600 font-medium">{validCount} valid</span>
                <span className="text-danger-600 font-medium">{invalidCount} invalid</span>
                <span className="text-warning-600 font-medium">{duplicateCount} duplicates</span>
              </div>
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0">
            <div className="max-h-96 overflow-y-auto">
              <DataTable columns={columns} data={validatedRows as unknown as Record<string, unknown>[]} />
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
              <Button
                variant="success"
                leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                onClick={handleSubmit}
                disabled={submitting || validCount === 0 || !selectedSession}
                isLoading={submitting}
              >
                {submitting ? `Uploading ${submitProgress.done}/${submitProgress.total}...` : `Submit ${validCount} Valid Results`}
              </Button>
              <Button variant="outline" leftIcon={<Trash2 className="w-4 h-4" />} onClick={handleClear} disabled={submitting}>
                Clear All
              </Button>
            </div>
          </div>
        </Card>
      )}

      {validatedRows.length === 0 && rawRows.length === 0 && (
        <Card>
          <div className="p-12 flex flex-col items-center text-center">
            <FileSpreadsheet className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-4" />
            <h3 className="text-lg font-semibold text-surface-700 dark:text-surface-300 mb-2">No Results Loaded</h3>
            <p className="text-sm text-surface-500 max-w-sm mb-4">
              Download the CSV template, fill in student matric numbers, course codes, CA and exam scores, then upload the file.
            </p>
            <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-4 text-left text-xs font-mono text-surface-600 dark:text-surface-400">
              <p className="mb-1 text-[10px] text-surface-400 uppercase tracking-wider">CSV Format</p>
              <p>matric_number,course_code,ca_score,exam_score</p>
              <p>CPE/2020/001,CPE301,25,55</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default BulkResultsUploadPage;
