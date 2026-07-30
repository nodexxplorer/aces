import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Printer, Download, Loader2, Users } from 'lucide-react';
import { listLecturerAssignments, type LecturerAssignment } from '../../api/lecturers';
import { getCourseResults } from '../../api/results';

interface StudentRow {
  matricNumber: string;
  name: string;
  courseCode: string;
  status: string;
}

const ClassListPage = () => {
  const { user } = useAuth();
  const { error: notifyError, success } = useNotification();
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingS, setLoadingS] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    listLecturerAssignments(user.id)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setAssignments(arr);
        if (arr.length > 0) setSelectedId(arr[0].id);
      })
      .catch(() => notifyError('Error', 'Failed to load assignments'))
      .finally(() => setLoadingA(false));
  }, [user?.id]);

  const sel = assignments.find((a) => a.id === selectedId);

  const load = useCallback(async () => {
    if (!sel) return;
    setLoadingS(true);
    try {
      const res = await getCourseResults(sel.course_id, sel.session_id);
      setStudents((res || []).map((r: any) => ({
        matricNumber: r.matric_number || r.matricNumber || '—',
        name: r.student_name || r.studentName || '—',
        courseCode: sel.course_code,
        status: r.status || 'pending',
      })));
    } catch { setStudents([]); }
    finally { setLoadingS(false); }
  }, [sel?.id]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    const rows = ['Matric,Name,Course,Status', ...students.map((s) => `${s.matricNumber},${s.name},${s.courseCode},${s.status}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `class_list_${sel?.course_code || 'export'}.csv`; a.click();
    URL.revokeObjectURL(url);
    success('Downloaded', 'Class list exported as CSV.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Class List</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Student rosters for your assigned courses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Print</Button>
          <Button variant="outline" leftIcon={<Download className="w-4 h-4" />} onClick={handleExport} disabled={!students.length}>Export CSV</Button>
        </div>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Enrolled Students</CardTitle>
            <CardDescription>Filtered by assigned course</CardDescription>
          </div>
          {loadingA ? <Loader2 className="w-5 h-5 animate-spin text-primary-500" /> : (
            <Select options={assignments.map((a) => ({ value: a.id, label: `${a.course_code} — ${a.course_title}` }))}
              value={selectedId} onChange={(e) => setSelectedId(e.target.value)} placeholder="Select course" />
          )}
        </CardHeader>
        {loadingS ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500 mr-2" /><span className="text-sm text-surface-500">Loading...</span></div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-10 h-10 text-surface-300 mb-3" />
            <p className="text-sm text-surface-500">No students found for this course yet.</p>
            <p className="text-xs text-surface-400 mt-1">Students appear once results are submitted for this course.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                  {['Matric Number', 'Name', 'Course', 'Result Status'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {students.map((s, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4 font-mono text-xs font-semibold">{s.matricNumber}</td>
                    <td className="px-6 py-4">{s.name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{s.courseCode}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${s.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClassListPage;
