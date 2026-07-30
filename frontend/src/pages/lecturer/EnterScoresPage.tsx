import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { calculateGrade } from '../../utils/cgpa';
import { Save, AlertCircle, Loader2 } from 'lucide-react';
import { listLecturerAssignments, type LecturerAssignment } from '../../api/lecturers';
import { getCourseResults, updateScore } from '../../api/results';

interface Row { resultId?: string; matricNumber: string; name: string; ca: string; exam: string; }

const EnterScoresPage = () => {
  const { user } = useAuth();
  const { success, warning, error: notifyError } = useNotification();
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingA, setLoadingA] = useState(true);
  const [loadingR, setLoadingR] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    listLecturerAssignments(user.id)
      .then((d) => { const a = Array.isArray(d) ? d : []; setAssignments(a); if (a.length) setSelectedId(a[0].id); })
      .catch(() => notifyError('Error', 'Failed to load assignments'))
      .finally(() => setLoadingA(false));
  }, [user?.id]);

  const sel = assignments.find((a) => a.id === selectedId);

  const load = useCallback(async () => {
    if (!sel) return;
    setLoadingR(true);
    try {
      const res = await getCourseResults(sel.course_id, sel.session_id);
      setRows((res || []).map((r: any) => ({
        resultId: r.id,
        matricNumber: r.matric_number || r.matricNumber || '—',
        name: r.student_name || r.studentName || '—',
        ca: String(r.ca_score ?? r.caScore ?? ''),
        exam: String(r.exam_score ?? r.examScore ?? ''),
      })));
    } catch { setRows([]); }
    finally { setLoadingR(false); }
  }, [sel?.id]);

  useEffect(() => { load(); }, [load]);

  const change = (i: number, f: 'ca' | 'exam', v: string) => {
    if (v !== '' && !/^\d+(\.\d*)?$/.test(v)) return;
    setRows((p) => { const c = [...p]; c[i] = { ...c[i], [f]: v }; return c; });
  };

  const handleSave = async () => {
    for (const r of rows) {
      const ca = parseFloat(r.ca || '0'), exam = parseFloat(r.exam || '0');
      if (ca > 30 || exam > 70) { warning('Input Error', `CA ≤ 30, Exam ≤ 70. Check ${r.name}.`); return; }
    }
    setSaving(true);
    let ok = 0, fail = 0;
    for (const r of rows) {
      if (!r.resultId) continue;
      try { await updateScore(r.resultId, { caScore: parseFloat(r.ca || '0'), examScore: parseFloat(r.exam || '0') }); ok++; }
      catch { fail++; }
    }
    setSaving(false);
    if (!fail) success('Saved', `${ok} score(s) updated.`);
    else notifyError('Partial', `${ok} saved, ${fail} failed.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Enter Class Scores</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Update CA and exam scores for your course.</p>
        </div>
        <Button isLoading={saving} onClick={handleSave} leftIcon={<Save className="w-4 h-4" />} disabled={!rows.length}>Save Changes</Button>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle>Score Sheet</CardTitle><CardDescription>Edit scores for the selected course</CardDescription></div>
          {loadingA ? <Loader2 className="w-5 h-5 animate-spin text-primary-500" /> : (
            <Select options={assignments.map((a) => ({ value: a.id, label: `${a.course_code} — ${a.course_title}` }))}
              value={selectedId} onChange={(e) => setSelectedId(e.target.value)} placeholder="Select course" />
          )}
        </CardHeader>
        {loadingR ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary-500 mr-2" /><span className="text-sm text-surface-500">Loading scores...</span></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-surface-400">No results found for this course. Submit via Single Entry first.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                  {['Matric', 'Name', 'CA (30)', 'Exam (70)', 'Total', 'Grade'].map((h) => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {rows.map((r, i) => {
                  const ca = parseFloat(r.ca || '0'), exam = parseFloat(r.exam || '0');
                  const total = ca + exam, isErr = ca > 30 || exam > 70;
                  return (
                    <tr key={i} className={isErr ? 'bg-danger-500/5' : ''}>
                      <td className="px-6 py-4 font-mono text-xs">{r.matricNumber}</td>
                      <td className="px-6 py-4">{r.name}</td>
                      <td className="px-6 py-2"><input type="text" value={r.ca} maxLength={4} onChange={(e) => change(i, 'ca', e.target.value)} className={`w-20 px-2 py-1 text-sm bg-white dark:bg-surface-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${ca > 30 ? 'border-danger-500' : 'border-surface-300 dark:border-surface-600'}`} /></td>
                      <td className="px-6 py-2"><input type="text" value={r.exam} maxLength={4} onChange={(e) => change(i, 'exam', e.target.value)} className={`w-20 px-2 py-1 text-sm bg-white dark:bg-surface-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${exam > 70 ? 'border-danger-500' : 'border-surface-300 dark:border-surface-600'}`} /></td>
                      <td className="px-6 py-4 font-bold">{isErr ? '-' : total}</td>
                      <td className="px-6 py-4 font-bold text-primary-500">{isErr ? <AlertCircle className="w-5 h-5 text-danger-500" /> : calculateGrade(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EnterScoresPage;
