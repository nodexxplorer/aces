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
import { getAllResults, updateScore, approveResult, enterScore, deleteResult, getStudentResults } from '../../api/results';
import { getCourses } from '../../api/courses';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import { searchStudentsForRoles } from '../../api/role-management';
import type { Course, Session, StudentForRoleManagement } from '../../types';

type Tab = 'manage' | 'bulk' | 'single';

/* ── Manage Tab ──────────────────────────────── */

function ManageTab() {
  const { success, error: notifyError } = useNotification();
  const [students, setStudents] = useState<StudentForRoleManagement[]>([]);
  const [stuSearch, setStuSearch] = useState('');
  const [sel, setSel] = useState<StudentForRoleManagement | null>(null);
  const [loadingStu, setLoadingStu] = useState(true);
  const [sRes, setSRes] = useState<any[]>([]);
  const [mgCrs, setMgCrs] = useState<Course[]>([]);
  const [mgSess, setMgSess] = useState<Session[]>([]);
  const [semesterMap, setSemesterMap] = useState<Record<string, any[]>>({});
  const [loadingR, setLoadingR] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [eCa, setECa] = useState('');
  const [eEx, setEEx] = useState('');
  const [saving, setSaving] = useState(false);
  const [expKey, setExpKey] = useState<string | null>(null);

  useEffect(() => {
    setLoadingStu(true);
    Promise.all([
      searchStudentsForRoles({ per_page: 500 }).catch(() => ({ data: [] })),
      getCourses().catch(() => []),
      getSessions().catch(() => []),
    ]).then(([sr, cr, se]) => {
      setStudents(Array.isArray((sr as any).data) ? (sr as any).data : []);
      setMgCrs(Array.isArray(cr) ? cr : []);
      setMgSess(Array.isArray(se) ? se : []);
    }).catch(() => notifyError('Error', 'Failed to load')).finally(() => setLoadingStu(false));
  }, []);

  const loadR = useCallback(async (student: StudentForRoleManagement) => {
    setSel(student); setExpKey(null); setEditId(null); setLoadingR(true);
    setSRes([]); setSemesterMap({});
    try {
      // Use getStudentResults to get the target student's results with full session_id and semester_id
      const data = await getStudentResults(student.student_id || student.id);
      const filt = Array.isArray(data) ? data : [];
      setSRes(filt);
      // Load semesters for each session in the results
      const sids = [...new Set(filt.map((r: any) => r.session_id).filter(Boolean))] as string[];
      const semMap: Record<string, any[]> = {};
      await Promise.all(sids.map(async (sid: string) => {
        try { semMap[sid] = await listSessionSemesters(sid); } catch { semMap[sid] = []; }
      }));
      setSemesterMap(semMap);
    } catch { notifyError('Error', 'Failed to load results'); }
    finally { setLoadingR(false); }
  }, []);

  const pf = (v: any) => { const n = parseFloat(String(v ?? 0)); return isNaN(n) ? 0 : n; };
  const cLk = new Map(mgCrs.map(c => [c.id, c]));

  const courseLookup = new Map(mgCrs.map(c => [c.id, c]));
  const sessionLookup = new Map(mgSess.map(s => [s.id, s]));

  const sections = (() => {
    const map = new Map<string, any[]>();
    for (const r of sRes) {
      const key = `${r.session_id ?? 'unknown'}_${r.semester_id ?? 'unknown'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const arr: any[] = [];
    let sn = 1;
    const keys = [...map.keys()].sort();
    let cumulativeGP = 0, cumulativeUnits = 0;
    for (const key of keys) {
      const [sessionId, semesterId] = key.split('_');
      const sectionResults = map.get(key)!;
      const session = sessionLookup.get(sessionId);
      const sems = semesterMap[sessionId] ?? [];
      const sem = sems.find((s: any) => s.id === semesterId);
      let secGP = 0, secUnits = 0;
      for (const r of sectionResults) {
        const c = courseLookup.get(r.course_id);
        const units = c?.unit ?? 0;
        const gp = pf(r.grade_point);
        secGP += units * gp;
        secUnits += units;
      }
      cumulativeGP += secGP;
      cumulativeUnits += secUnits;
      arr.push({
        k: key,
        sn: sn++,
        sessionId,
        semesterId,
        sessName: session?.name ?? sessionId?.slice(0, 8) ?? '—',
        semName: sem ? (sem.name.charAt(0).toUpperCase() + sem.name.slice(1)) + ' Semester' : (semesterId?.slice(0, 8) ?? '—'),
        rows: sectionResults,
        gpa: cumulativeUnits > 0 ? cumulativeGP / cumulativeUnits : 0,
        totalUnits: cumulativeUnits,
      });
    }
    return arr;
  })();

  const doSave = async (id: string) => {
    const ca = parseFloat(eCa), ex = parseFloat(eEx);
    if (isNaN(ca) || ca < 0 || ca > 30) { notifyError('Invalid', 'CA 0–30'); return; }
    if (isNaN(ex) || ex < 0 || ex > 70) { notifyError('Invalid', 'Exam 0–70'); return; }
    if (ca + ex > 100) { notifyError('Invalid', 'Total ≤ 100'); return; }
    setSaving(true);
    try { await updateScore(id, { caScore: ca, examScore: ex }); setSRes(p => p.map(r => r.id === id ? { ...r, ca_score: ca, exam_score: ex } : r)); success('Saved', 'Updated'); setEditId(null); }
    catch (err: any) { notifyError('Error', err?.message || 'Failed'); } finally { setSaving(false); }
  };
  const doApprove = async (id: string) => { try { await approveResult(id); setSRes(p => p.map(r => r.id === id ? { ...r, status: 'approved' } : r)); success('Approved', ''); } catch (err: any) { notifyError('Error', err?.message || 'Failed'); } };
  const doDelete = async (id: string) => { if (!confirm('Delete permanently?')) return; try { await deleteResult(id); setSRes(p => p.filter(r => r.id !== id)); success('Deleted', ''); } catch (err: any) { notifyError('Error', err?.message || 'Failed'); } };
  const filtStu = students.filter(s => { const q = stuSearch.toLowerCase(); return (s.full_name || '').toLowerCase().includes(q) || (s.matric_number || '').toLowerCase().includes(q); });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2"><Search className="w-4 h-4 text-primary-500" /> Select Student</p>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-surface-400" />
          <input type="text" placeholder="Search name or matric..." value={stuSearch} onChange={e => setStuSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
        </div>
        {loadingStu ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div> : (
          <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
            {filtStu.map(s => (<button key={s.id} onClick={() => loadR(s)} className={`w-full text-left p-2.5 rounded-lg text-sm transition-all ${sel?.id === s.id ? 'bg-primary-500 text-white font-medium shadow-sm' : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300'}`}><p className="truncate font-semibold">{s.full_name}</p><p className={`text-xs truncate ${sel?.id === s.id ? 'text-primary-100' : 'text-surface-400'}`}>{s.matric_number} · {s.level ? `${s.level } Level` : '—'}</p></button>))}
            {filtStu.length === 0 && <p className="text-xs text-center text-surface-400 py-4">No students found</p>}
          </div>
        )}
      </Card>
      <div className="md:col-span-2 space-y-4">
        {!sel ? (
          <Card className="p-12 flex flex-col items-center text-center"><Database className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-3" /><p className="font-semibold text-surface-700 dark:text-surface-300">Select a student</p><p className="text-sm text-surface-400 mt-1">Choose a student from the list to view and manage their results.</p></Card>
        ) : loadingR ? (
          <Card className="p-12 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /><span className="text-sm text-surface-500">Loading results...</span></Card>
        ) : (<>
          <Card className="p-4"><h3 className="font-bold text-lg text-surface-900 dark:text-white">{sel.full_name}</h3><p className="text-xs text-surface-400 mt-0.5">{sel.matric_number} · {sel.level ? `${sel.level * 100} Level` : '—'} · {sections.length} semester(s) on record</p></Card>
          {sections.length === 0 ? <Card className="p-8 text-center text-sm text-surface-400">No results found for this student.</Card> : (
            <Card><div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">{['S/N','Session','Semester','Courses','CGPA to Date','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">{h}</th>)}</tr></thead>
              <tbody>{sections.map((sec: any) => { const isE = expKey === sec.k; return (<>
                <tr key={sec.k} className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-surface-500">{sec.sn}</td>
                  <td className="px-4 py-3 font-semibold text-surface-900 dark:text-white">{sec.sessName}</td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{sec.semName}</td>
                  <td className="px-4 py-3">{sec.rows.length}</td>
                  <td className="px-4 py-3 font-bold text-primary-600 dark:text-primary-400">{sec.gpa.toFixed(2)}</td>
                  <td className="px-4 py-3"><Button size="xs" variant="ghost" leftIcon={isE ? <X className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />} onClick={() => setExpKey(isE ? null : sec.k)}>{isE ? 'Hide' : 'View'}</Button></td>
                </tr>
                {isE && (<tr key={`${sec.k}_d`}><td colSpan={6} className="bg-surface-50 dark:bg-surface-800/20"><div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700 overflow-x-auto">
                  <table className="w-full text-xs"><thead><tr className="border-b border-surface-200 dark:border-surface-700">{['Student','Matric No.','Course','CA','Exam','Total','Status','Actions'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-surface-500 dark:text-surface-400">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                      {sec.rows.map((r: any) => { const isEd = editId === r.id; const ca = pf(r.ca_score ?? r.caScore); const ex = pf(r.exam_score ?? r.examScore); const tot = pf(r.total_score ?? r.totalScore) || (ca + ex); const code = r.courseCode || r.course_code || cLk.get(r.course_id)?.code || '—'; const sc = r.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'; return (
                        <tr key={r.id} className="hover:bg-white dark:hover:bg-surface-800/40">
                          <td className="px-3 py-2">{sel.full_name}</td>
                          <td className="px-3 py-2 font-mono">{r.matric_number || sel.matric_number || '—'}</td>
                          <td className="px-3 py-2 font-semibold font-mono">{code}</td>
                          <td className="px-3 py-2">{isEd ? <input type="number" value={eCa} onChange={e => setECa(e.target.value)} className="w-14 px-1 py-0.5 border rounded text-xs bg-white dark:bg-surface-900 dark:border-surface-600 focus:outline-none" /> : ca}</td>
                          <td className="px-3 py-2">{isEd ? <input type="number" value={eEx} onChange={e => setEEx(e.target.value)} className="w-14 px-1 py-0.5 border rounded text-xs bg-white dark:bg-surface-900 dark:border-surface-600 focus:outline-none" /> : ex}</td>
                          <td className="px-3 py-2 font-semibold">{isEd ? (parseFloat(eCa||'0')+parseFloat(eEx||'0')).toFixed(0) : tot}</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${sc}`}>{r.status ?? 'pending'}</span></td>
                          <td className="px-3 py-2"><div className="flex items-center gap-1">
                            {isEd ? (<><Button size="xs" variant="success" leftIcon={saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} onClick={() => doSave(r.id)} disabled={saving}>Save</Button><Button size="xs" variant="outline" leftIcon={<X className="w-3 h-3" />} onClick={() => setEditId(null)}>Cancel</Button></>
                            ) : (<><Button size="xs" variant="ghost" leftIcon={<Edit3 className="w-3 h-3" />} onClick={() => { setEditId(r.id); setECa(String(pf(r.ca_score))); setEEx(String(pf(r.exam_score))); }}>Edit</Button>{r.status !== 'approved' && <Button size="xs" variant="success" leftIcon={<CheckCircle className="w-3 h-3" />} onClick={() => doApprove(r.id)}>Approve</Button>}<Button size="xs" variant="danger" leftIcon={<Trash2 className="w-3 h-3" />} onClick={() => doDelete(r.id)}>Delete</Button></>)}
                          </div></td>
                        </tr>); })}
                    </tbody>
                  </table>
                  <div className="text-right text-xs text-surface-500 mt-2">CGPA to date: <span className="text-primary-600 dark:text-primary-400 font-bold">{sec.gpa.toFixed(2)}</span></div>
                </div></td></tr>)}
              </>); })}</tbody>
            </table></div></Card>
          )}
        </>)}
      </div>
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
  const [students, setStudents] = useState<StudentForRoleManagement[]>([]);
  const [existingResults, setExistingResults] = useState<any[]>([]);
  const [rawRows, setRawRows] = useState<CsvRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState({ done: 0, total: 0 });

  const fetchMetadata = useCallback(async () => {
    try {
      setLoadingMeta(true);
      const [sess, crs, stuRes] = await Promise.all([
        getSessions().catch(() => []),
        getCourses().catch(() => []),
        searchStudentsForRoles({ per_page: 500 }).catch(() => ({ data: [] })),
      ]);
      setSessions(Array.isArray(sess) ? sess : []);
      setCourses(Array.isArray(crs) ? crs : []);
      setStudents(Array.isArray((stuRes as any).data) ? (stuRes as any).data : []);
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
      if (isNaN(ca) || ca < 0 || ca > 30) errors.push('CA score must be 0–30');
      if (isNaN(exam) || exam < 0 || exam > 70) errors.push('Exam score must be 0–70');
      if (!isNaN(ca) && !isNaN(exam) && ca + exam > 100) {
        errors.push('Total score cannot exceed 100');
      }

      const student = students.find((s) =>
        (s.matric_number || '').toLowerCase() === row.matric_number.toLowerCase()
      );
      let studentId: string | undefined, courseId: string | undefined, studentName: string | undefined, courseTitle: string | undefined;
      if (!student) { errors.push('Student not found (will be linked on registration)'); }
      else { studentId = student.student_id; studentName = student.full_name || student.email; }

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
  const [students, setStudents] = useState<StudentForRoleManagement[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentForRoleManagement | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [caScore, setCaScore] = useState('');
  const [examScore, setExamScore] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMetadata = useCallback(async () => {
    try {
      setLoadingMeta(true);
      const [sess, crs, stuRes] = await Promise.all([
        getSessions().catch(() => []),
        getCourses().catch(() => []),
        searchStudentsForRoles({ per_page: 500 }).catch(() => ({ data: [] })),
      ]);
      setSessions(Array.isArray(sess) ? sess : []);
      setCourses(Array.isArray(crs) ? crs : []);
      setStudents(Array.isArray((stuRes as any).data) ? (stuRes as any).data : []);
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

  const filteredStudents = students.filter((s) => {
    if (!studentSearch || studentSearch.length < 2) return false;
    const q = studentSearch.toLowerCase();
    const name = (s.full_name || s.email || '').toLowerCase();
    const matric = (s.matric_number || '').toLowerCase();
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
    if (isNaN(caVal) || caVal < 0 || caVal > 30) { notifyError('Invalid CA', 'CA score must be between 0 and 30'); return; }
    if (isNaN(examVal) || examVal < 0 || examVal > 70) { notifyError('Invalid Exam', 'Exam score must be between 0 and 70'); return; }
    if (caVal + examVal > 100) {
      notifyError('Invalid Total', 'CA + Exam total cannot exceed 100');
      return;
    }

    try {
      setSubmitting(true);
      await enterScore({
        studentId: selectedStudent.student_id,
        courseId: selectedCourse,
        sessionId: selectedSession,
        semesterId: selectedSemester,
        caScore: caVal,
        examScore: examVal,
      });
      success('Result Entered', `${selectedStudent.matric_number} — ${caVal + examVal} total`);
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
                value={selectedStudent ? `${selectedStudent.matric_number} — ${selectedStudent.full_name || selectedStudent.email}` : studentSearch}
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
                {filteredStudents.map((s) => (
                  <button key={s.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors border-b border-surface-100 dark:border-surface-700 last:border-0"
                    onMouseDown={(e) => { e.preventDefault(); setSelectedStudent(s); setStudentSearch(''); setShowStudentDropdown(false); }}>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{s.matric_number}</p>
                    <p className="text-xs text-surface-500">{s.full_name || s.email}</p>
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
              <input type="number" min={0} max={30} step={0.5} value={caScore}
                onChange={(e) => setCaScore(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Exam Score (0–70)</label>
              <input type="number" min={0} max={70} step={0.5} value={examScore}
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
