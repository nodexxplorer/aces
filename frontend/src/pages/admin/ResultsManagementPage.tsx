import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '../../components/ui/Button';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import {
  Search, Loader2, Edit3, Save, X, CheckCircle, AlertTriangle,
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Trash2, Send, Database, PenLine
} from 'lucide-react';
import { getAllResults, updateScore, approveResult, enterScore } from '../../api/results';
import { getCourses } from '../../api/courses';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import { getStudents } from '../../api/users';
import type { Course, Session } from '../../types';

type Tab = 'manage' | 'bulk' | 'single';

/* ── Manage Tab ──────────────────────────────── */

const PAGE_SIZE = 25;

function ManageTab() {
  const { success, error: notifyError } = useNotification();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCa, setEditCa] = useState('');
  const [editExam, setEditExam] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllResults({ limit: 5000, offset: 0 });
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      notifyError('Load Failed', err?.response?.data?.error || err?.message || 'Could not load results');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const filtered = results.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.studentName || r.student_name || '').toLowerCase().includes(q) ||
      (r.matricNumber || r.matric_number || '').toLowerCase().includes(q) ||
      (r.courseCode || r.course_code || r.course?.code || '').toLowerCase().includes(q) ||
      (r.courseTitle || r.course_title || r.course?.title || '').toLowerCase().includes(q)
    );
  });

  const paginated = filtered.slice(offset, offset + PAGE_SIZE);

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditCa(String(r.caScore ?? r.ca_score ?? 0));
    setEditExam(String(r.examScore ?? r.exam_score ?? 0));
  };

  const cancelEdit = () => { setEditingId(null); setEditCa(''); setEditExam(''); };

  const handleSave = async (id: string) => {
    const ca = parseFloat(editCa);
    const exam = parseFloat(editExam);
    if (isNaN(ca) || ca < 0 || ca > 40) { notifyError('Invalid', 'CA score must be between 0 and 40'); return; }
    if (isNaN(exam) || exam < 0 || exam > 100) { notifyError('Invalid', 'Exam score must be between 0 and 100'); return; }
    try {
      setSaveLoading(true);
      await updateScore(id, { caScore: ca, examScore: exam });
      setResults((prev) => prev.map((r) => r.id === id ? { ...r, caScore: ca, ca_score: ca, examScore: exam, exam_score: exam } : r));
      success('Saved', 'Score updated successfully');
      cancelEdit();
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.error || err?.message || 'Could not update score');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveResult(id);
      setResults((prev) => prev.map((r) => r.id === id ? { ...r, status: 'approved' } : r));
      success('Approved', 'Result approved');
    } catch (err: any) {
      notifyError('Approval Failed', err?.response?.data?.error || err?.message || 'Could not approve');
    }
  };

  const g = (r: any, ...keys: string[]) => { for (const k of keys) if (r[k] !== undefined) return r[k]; return undefined; };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name, matric, or course..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <span className="text-xs text-surface-500">{filtered.length} result(s)</span>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading results...</span>
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-12 text-sm text-surface-400">No results found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    {['Student', 'Matric No.', 'Course', 'CA', 'Exam', 'Total', 'Status', 'Actions'].map((h) => (
                      <th key={h} className={`px-4 py-3 font-medium text-surface-600 dark:text-surface-400 ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
                  {paginated.map((r) => {
                    const isEditing = editingId === r.id;
                    const ca = g(r, 'caScore', 'ca_score') ?? 0;
                    const exam = g(r, 'examScore', 'exam_score') ?? 0;
                    const total = ca + exam;
                    const statusColor = r.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : r.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
                    return (
                      <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{g(r, 'studentName', 'student_name') || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-surface-700 dark:text-surface-300">{g(r, 'matricNumber', 'matric_number') || '—'}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-surface-900 dark:text-white">{g(r, 'courseCode', 'course_code', 'course.code') || '—'}</p>
                            <p className="text-[10px] text-surface-500">{g(r, 'courseTitle', 'course_title', 'course.title') || ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" value={editCa} onChange={(e) => setEditCa(e.target.value)} min={0} max={40}
                              className="w-16 px-2 py-1 text-xs border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
                          ) : <span className="font-mono text-xs">{ca}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="number" value={editExam} onChange={(e) => setEditExam(e.target.value)} min={0} max={100}
                              className="w-16 px-2 py-1 text-xs border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500" />
                          ) : <span className="font-mono text-xs">{exam}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <span className="font-mono text-xs font-semibold">{parseFloat(editCa || '0') + parseFloat(editExam || '0')}</span>
                          ) : <span className="font-mono text-xs font-semibold">{total}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColor}`}>
                            {r.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <Button size="xs" variant="success"
                                  leftIcon={saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                  onClick={() => handleSave(r.id)} disabled={saveLoading}>Save</Button>
                                <Button size="xs" variant="outline" leftIcon={<X className="w-3.5 h-3.5" />} onClick={cancelEdit}>Cancel</Button>
                              </>
                            ) : (
                              <>
                                <Button size="xs" variant="ghost" leftIcon={<Edit3 className="w-3.5 h-3.5" />} onClick={() => startEdit(r)}>Edit</Button>
                                {r.status !== 'approved' && (
                                  <Button size="xs" variant="success" leftIcon={<CheckCircle className="w-3.5 h-3.5" />} onClick={() => handleApprove(r.id)}>Approve</Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-500">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, offset + paginated.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button size="xs" variant="outline" disabled={offset === 0} onClick={() => setOffset((p) => Math.max(0, p - PAGE_SIZE))}>Previous</Button>
                <Button size="xs" variant="outline" disabled={filtered.length <= PAGE_SIZE || offset + PAGE_SIZE >= filtered.length} onClick={() => setOffset((p) => p + PAGE_SIZE)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ── Bulk Upload Tab ─────────────────────────── */

interface CsvRow {
  matric_number: string;
  course_code: string;
  ca_score: string;
  exam_score: string;
}

interface ValidatedRow extends CsvRow {
  status: 'valid' | 'invalid' | 'duplicate' | 'pending_student';
  errors: string[];
  studentId?: string;
  courseId?: string;
  studentName?: string;
  courseTitle?: string;
}

function BulkUploadTab() {
  const { success, error: notifyError } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [semesters, setSemesters] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [existingResults, setExistingResults] = useState<any[]>([]);
  const [rawRows, setRawRows] = useState<CsvRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
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
      notifyError('Error', 'Could not load metadata');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

  useEffect(() => {
    if (selectedSession) {
      listSessionSemesters(selectedSession)
        .then((sems) => { setSemesters(Array.isArray(sems) ? sems : []); setSelectedSemester(''); })
        .catch(() => setSemesters([]));
    }
  }, [selectedSession]);

  useEffect(() => {
    if (selectedSession && selectedSemester) {
      getAllResults({ limit: 5000, offset: 0 }).then((res) => {
        const items = Array.isArray(res) ? res : [];
        setExistingResults(items.filter((r: any) => r.session_id === selectedSession || r.sessionId === selectedSession));
      }).catch(() => {});
    }
  }, [selectedSession, selectedSemester]);

  const downloadTemplate = () => {
    const csv = 'matric_number,course_code,ca_score,exam_score\nCPE/2020/001,CPE301,25,55\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bulk_results_template.csv'; a.click();
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
    if (matricIdx === -1 || courseIdx === -1 || caIdx === -1 || examIdx === -1) return [];
    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      return { matric_number: cols[matricIdx] || '', course_code: cols[courseIdx] || '', ca_score: cols[caIdx] || '', exam_score: cols[examIdx] || '' };
    });
  };

  const validateRows = (rows: CsvRow[]) => {
    const seen = new Set<string>();
    const validated: ValidatedRow[] = rows.map((row) => {
      const errors: string[] = [];
      const ca = parseFloat(row.ca_score);
      const exam = parseFloat(row.exam_score);
      if (isNaN(ca) || ca < 0 || ca > 40) errors.push('CA score must be 0–40');
      if (isNaN(exam) || exam < 0 || exam > 100) errors.push('Exam score must be 0–100');

      const student = students.find((s: any) =>
        (s.matric_number || s.matricNumber || '').toLowerCase() === row.matric_number.toLowerCase()
      );
      let studentId: string | undefined, courseId: string | undefined, studentName: string | undefined, courseTitle: string | undefined;
      if (!student) { errors.push('Student not found (will be linked on registration)'); }
      else { studentId = student.id; studentName = student.full_name || student.fullName || student.email; }

      const course = courses.find((c: any) => (c.code || '').toLowerCase() === row.course_code.toLowerCase());
      if (!course) { errors.push('Course not found'); }
      else { courseId = course.id; courseTitle = course.title; }

      let isDuplicate = false;
      const matchingStudentId = studentId;
      if (matchingStudentId && existingResults.some((r: any) => (r.student_id || r.studentId) === matchingStudentId && (r.course_id || r.courseId) === courseId)) {
        errors.push('Result already exists'); isDuplicate = true;
      }
      const key = `${studentId || row.matric_number}_${courseId || row.course_code}`.toLowerCase();
      if (seen.has(key) && !isDuplicate) { errors.push('Duplicate row in CSV'); isDuplicate = true; }
      seen.add(key);

      const hasCourseError = !course;
      const isPendingStudent = !student && !hasCourseError;
      let status: ValidatedRow['status'] = isDuplicate ? 'duplicate' : hasCourseError ? 'invalid' : isPendingStudent ? 'pending_student' : 'valid';
      if (isPendingStudent && errors.length === 1) { errors.pop(); } // remove the "Student not found" warning from errors for pending

      return { ...row, status, errors, studentId, courseId, studentName, courseTitle };
    });
    setValidatedRows(validated);
  };

  useEffect(() => { if (rawRows.length > 0) validateRows(rawRows); }, [students, courses, existingResults]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const rows = parseCSV(ev.target?.result as string); setRawRows(rows); validateRows(rows); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!selectedSession) { notifyError('Missing Session', 'Please select an academic session'); return; }
    if (!selectedSemester) { notifyError('Missing Semester', 'Please select a semester'); return; }
    const validRows = validatedRows.filter((r) => r.status === 'valid' || r.status === 'pending_student');
    if (validRows.length === 0) { notifyError('No Valid Rows', 'There are no valid rows to upload'); return; }

    try {
      setSubmitting(true);
      setSubmitProgress({ done: 0, total: validRows.length });
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          await enterScore({
            studentId: row.studentId,
            courseId: row.courseId!,
            sessionId: selectedSession,
            semesterId: selectedSemester,
            caScore: parseFloat(row.ca_score),
            examScore: parseFloat(row.exam_score),
            matricNumber: row.studentId ? undefined : row.matric_number,
          });
        } catch (err: any) {
          failed++;
          const detail = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Unknown error';
          errors.push(`Row ${i + 1} (${row.matric_number}/${row.course_code}): ${detail}`);
        }
        setSubmitProgress({ done: i + 1, total: validRows.length });
      }

      if (failed === 0) {
        success('Upload Complete', `${validRows.length} results uploaded successfully`);
        setValidatedRows([]); setRawRows([]);
      } else if (failed === validRows.length) {
        notifyError('Upload Failed', `All ${failed} rows failed. ${errors.slice(0, 5).join(' | ')}`);
      } else {
        const moreInfo = errors.length > 3 ? ` ...and ${errors.length - 3} more` : '';
        notifyError('Partial Upload', `${validRows.length - failed} succeeded, ${failed} failed. ${errors.slice(0, 3).join(' | ')}${moreInfo}`);
      }
    } catch (err: any) {
      notifyError('Upload Failed', err?.response?.data?.error || err?.message || 'Could not upload results');
    } finally {
      setSubmitting(false);
    }
  };

  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const pendingStudentCount = validatedRows.filter((r) => r.status === 'pending_student').length;
  const invalidCount = validatedRows.filter((r) => r.status === 'invalid').length;
  const duplicateCount = validatedRows.filter((r) => r.status === 'duplicate').length;

  const columns = [
    { key: 'matric_number', label: 'Matric Number', render: (_: unknown, row: any) => <span className="font-mono text-xs">{row.matric_number}</span> },
    { key: 'course', label: 'Course', render: (_: unknown, row: any) => (
      <div><p className="font-semibold text-xs">{row.course_code}</p><p className="text-[10px] text-surface-500">{row.courseTitle || ''}</p></div>
    )},
    { key: 'studentName', label: 'Student', render: (_: unknown, row: any) => <span className="text-xs">{row.studentName || '—'}</span> },
    { key: 'scores', label: 'CA / Exam', render: (_: unknown, row: any) => <span className="text-xs font-mono">{row.ca_score} / {row.exam_score}</span> },
    { key: 'status', label: 'Status', render: (_: unknown, row: any) => {
      const color = row.status === 'valid' ? 'text-success-600 bg-success-50' : row.status === 'pending_student' ? 'text-info-600 bg-info-50' : row.status === 'duplicate' ? 'text-warning-600 bg-warning-50' : 'text-danger-600 bg-danger-50';
      const Icon = row.status === 'valid' ? CheckCircle2 : row.status === 'pending_student' ? CheckCircle2 : row.status === 'duplicate' ? AlertTriangle : XCircle;
      const label = row.status === 'pending_student' ? 'pending link' : row.status;
      return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}><Icon className="w-3 h-3" />{label}</span>;
    }},
    { key: 'errors', label: 'Issues', render: (_: unknown, row: any) => (
      <div className="text-[10px] text-danger-500 space-y-0.5">{row.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}</div>
    )},
  ];

  return (
    <div className="space-y-4">
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
            <Select label="Academic Session" options={sessions.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} placeholder={loadingMeta ? 'Loading...' : 'Select session'} />
            <Select label="Semester" options={semesters.map((s: any) => ({ value: s.id, label: s.name }))}
              value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}
              placeholder={!selectedSession ? 'Select session first' : 'Select semester'} disabled={!selectedSession} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={downloadTemplate}>Download CSV Template</Button>
            <Button variant="outline" leftIcon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>Upload CSV</Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </div>
          {loadingMeta && <p className="text-xs text-surface-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading students and courses...</p>}
          <div className="text-xs text-surface-500">Students loaded: {students.length} | Courses loaded: {courses.length}</div>
        </div>
      </Card>

      {validatedRows.length > 0 && (
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center justify-between">
              <span>Validation Preview</span>
              <div className="flex gap-3 text-xs">
                <span className="text-success-600 font-medium">{validCount} valid</span>
                {pendingStudentCount > 0 && <span className="text-info-600 font-medium">{pendingStudentCount} pending link</span>}
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
              <Button variant="success"
                leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                onClick={handleSubmit} disabled={submitting || (validCount + pendingStudentCount) === 0 || !selectedSession} isLoading={submitting}>
                {submitting ? `Uploading ${submitProgress.done}/${submitProgress.total}...` : `Submit ${validCount + pendingStudentCount} Valid Results`}
              </Button>
              <Button variant="outline" leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => { setRawRows([]); setValidatedRows([]); }} disabled={submitting}>Clear All</Button>
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
}

/* ── Single Entry Tab ────────────────────────── */

function SingleEntryTab() {
  const { success, error: notifyError } = useNotification();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [semesters, setSemesters] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [caScore, setCaScore] = useState('');
  const [examScore, setExamScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMetadata = useCallback(async () => {
    try {
      setLoadingMeta(true);
      const [sess, crs, stu] = await Promise.all([
        getSessions().catch(() => []),
        getCourses().catch(() => []),
        getStudents({ perPage: 5000 }).catch(() => []),
      ]);
      setSessions(Array.isArray(sess) ? sess : []);
      setCourses(Array.isArray(crs) ? crs : []);
      setStudents(Array.isArray(stu) ? stu : []);
    } catch {
      notifyError('Error', 'Could not load metadata');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { fetchMetadata(); }, [fetchMetadata]);

  useEffect(() => {
    if (selectedSession) {
      listSessionSemesters(selectedSession)
        .then((sems) => { setSemesters(Array.isArray(sems) ? sems : []); setSelectedSemester(''); })
        .catch(() => setSemesters([]));
    }
  }, [selectedSession]);

  const filteredStudents = students.filter((s: any) => {
    if (!studentSearch || studentSearch.length < 2) return false;
    const q = studentSearch.toLowerCase();
    const name = (s.full_name || s.fullName || s.email || '').toLowerCase();
    const matric = (s.matric_number || s.matricNumber || '').toLowerCase();
    return name.includes(q) || matric.includes(q);
  }).slice(0, 20);

  const ca = parseFloat(caScore) || 0;
  const exam = parseFloat(examScore) || 0;

  const handleSubmit = async () => {
    if (!selectedSession) { notifyError('Missing Session', 'Please select an academic session'); return; }
    if (!selectedSemester) { notifyError('Missing Semester', 'Please select a semester'); return; }
    if (!selectedStudent) { notifyError('Missing Student', 'Please search and select a student'); return; }
    if (!selectedCourse) { notifyError('Missing Course', 'Please select a course'); return; }

    const caVal = parseFloat(caScore);
    const examVal = parseFloat(examScore);
    if (isNaN(caVal) || caVal < 0 || caVal > 40) { notifyError('Invalid CA', 'CA score must be between 0 and 40'); return; }
    if (isNaN(examVal) || examVal < 0 || examVal > 100) { notifyError('Invalid Exam', 'Exam score must be between 0 and 100'); return; }

    try {
      setSubmitting(true);
      await enterScore({
        studentId: selectedStudent.id,
        courseId: selectedCourse,
        sessionId: selectedSession,
        semesterId: selectedSemester,
        caScore: caVal,
        examScore: examVal,
      });
      success('Result Entered', `${selectedStudent.matric_number || selectedStudent.matricNumber} — ${caVal + examVal} total`);
      setCaScore('');
      setExamScore('');
      setSelectedStudent(null);
      setStudentSearch('');
      setSelectedCourse('');
    } catch (err: any) {
      notifyError('Submission Failed', err?.response?.data?.error || err?.message || 'Could not enter result');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary-500" />
            Single Result Entry
          </CardTitle>
          <CardDescription>Enter one result at a time by selecting session, semester, student, course, and scores</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Academic Session" options={sessions.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} placeholder={loadingMeta ? 'Loading...' : 'Select session'} />
            <Select label="Semester" options={semesters.map((s: any) => ({ value: s.id, label: s.name }))}
              value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}
              placeholder={!selectedSession ? 'Select session first' : 'Select semester'} disabled={!selectedSession} />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Student</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search by name or matric number..."
                value={selectedStudent ? `${selectedStudent.matric_number || selectedStudent.matricNumber} — ${selectedStudent.full_name || selectedStudent.fullName || selectedStudent.email}` : studentSearch}
                onChange={(e) => { setStudentSearch(e.target.value); setSelectedStudent(null); setShowStudentDropdown(true); }}
                onFocus={() => { if (!selectedStudent) setShowStudentDropdown(true); }}
                onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
                disabled={!!selectedStudent}
                className="w-full pl-10 pr-10 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60"
              />
              {selectedStudent && (
                <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showStudentDropdown && !selectedStudent && filteredStudents.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredStudents.map((s: any) => (
                  <button key={s.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors border-b border-surface-100 dark:border-surface-700 last:border-0"
                    onMouseDown={(e) => { e.preventDefault(); setSelectedStudent(s); setStudentSearch(''); setShowStudentDropdown(false); }}>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{s.matric_number || s.matricNumber}</p>
                    <p className="text-xs text-surface-500">{s.full_name || s.fullName || s.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Select label="Course" options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
            value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} placeholder="Select course" />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">CA Score (0–30)</label>
              <input type="number" min={0} max={40} step={0.5} value={caScore}
                onChange={(e) => setCaScore(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Exam Score (0–70)</label>
              <input type="number" min={0} max={100} step={0.5} value={examScore}
                onChange={(e) => setExamScore(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Total</label>
              <div className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg font-mono font-semibold text-surface-900 dark:text-white">
                {ca + exam || '—'}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button variant="success"
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              onClick={handleSubmit} disabled={submitting || !selectedStudent || !selectedCourse || !selectedSession || !selectedSemester}
              isLoading={submitting}>
              {submitting ? 'Submitting...' : 'Submit Result'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Combined Page ───────────────────────────── */

const tabs = [
  { key: 'manage' as Tab, label: 'Manage Results', icon: Database },
  { key: 'bulk' as Tab, label: 'Bulk Upload', icon: Upload },
  { key: 'single' as Tab, label: 'Single Entry', icon: PenLine },
];

const ResultsManagementPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('manage');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Results Management</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          View, edit scores, approve results, or upload results in bulk.
        </p>
      </div>

      <div className="flex gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'manage' && <ManageTab />}
      {activeTab === 'bulk' && <BulkUploadTab />}
      {activeTab === 'single' && <SingleEntryTab />}
    </div>
  );
};

export default ResultsManagementPage;
