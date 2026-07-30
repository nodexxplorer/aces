import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import { getStudentResults } from '../../api/results';
import { getCourses } from '../../api/courses';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import type { Course, Session, SemesterEntry } from '../../types';

interface RawResult {
  id: string;
  course_id: string;
  ca_score: number | string;
  exam_score: number | string;
  total_score: number | string;
  grade?: string | null;
  grade_point?: number | string;
  session_id?: string;
  semester_id?: string;
  status?: string;
  is_carryover?: boolean;
  matric_number?: string;
  course_code?: string;
  course_title?: string;
  courseCode?: string;
  courseTitle?: string;
}

interface SemesterSection {
  sn: number;
  sessionId: string;
  sessionName: string;
  semesterId: string;
  semesterName: string;
  results: RawResult[];
  gpaToDate: number;
  totalUnitsToDate: number;
}

const parseScore = (v: number | string | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

export default function ResultsPage() {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [results, setResults] = useState<RawResult[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [semesterMap, setSemesterMap] = useState<Record<string, SemesterEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [printSection, setPrintSection] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      getStudentResults(user.id).catch(() => []),
      getCourses().catch(() => []),
      getSessions().catch(() => []),
    ]).then(async ([res, crs, sess]) => {
      const rawResults = Array.isArray(res) ? (res as unknown as RawResult[]) : [];
      setResults(rawResults);
      setCourses(Array.isArray(crs) ? crs : []);
      const sessArr = Array.isArray(sess) ? sess : [];
      setSessions(sessArr);
      const sessionIds = [...new Set(rawResults.map(r => r.session_id).filter(Boolean))] as string[];
      const semMap: Record<string, SemesterEntry[]> = {};
      await Promise.all(sessionIds.map(async (sid) => {
        try { semMap[sid] = await listSessionSemesters(sid); } catch { semMap[sid] = []; }
      }));
      setSemesterMap(semMap);
    }).catch(() => notifyError('Error', 'Failed to load results')).finally(() => setLoading(false));
  }, [user?.id]);

  const courseLookup = new Map(courses.map(c => [c.id, c]));
  const sessionLookup = new Map(sessions.map(s => [s.id, s]));

  // Build semester sections sorted chronologically
  const sections: SemesterSection[] = (() => {
    const map = new Map<string, RawResult[]>();
    for (const r of results) {
      const key = `${r.session_id ?? 'unknown'}_${r.semester_id ?? 'unknown'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const arr: SemesterSection[] = [];
    let sn = 1;
    const keys = [...map.keys()].sort();
    let cumulativeGP = 0, cumulativeUnits = 0;
    for (const key of keys) {
      const [sessionId, semesterId] = key.split('_');
      const sectionResults = map.get(key)!;
      const session = sessionLookup.get(sessionId);
      const sems = semesterMap[sessionId] ?? [];
      const sem = sems.find(s => s.id === semesterId);
      let secGP = 0, secUnits = 0;
      for (const r of sectionResults) {
        const c = courseLookup.get(r.course_id);
        const units = c?.unit ?? 0;
        const gp = parseScore(r.grade_point);
        secGP += units * gp;
        secUnits += units;
      }
      cumulativeGP += secGP;
      cumulativeUnits += secUnits;
      arr.push({
        sn: sn++,
        sessionId,
        sessionName: session?.name ?? sessionId?.slice(0, 8) ?? '—',
        semesterId,
        semesterName: sem ? (sem.name.charAt(0).toUpperCase() + sem.name.slice(1)) + ' Semester' : (semesterId?.slice(0, 8) ?? '—'),
        results: sectionResults,
        gpaToDate: cumulativeUnits > 0 ? cumulativeGP / cumulativeUnits : 0,
        totalUnitsToDate: cumulativeUnits,
      });
    }
    return arr;
  })();

  const overallGPA = sections.length > 0 ? sections[sections.length - 1].gpaToDate : 0;
  const overallUnits = sections.length > 0 ? sections[sections.length - 1].totalUnitsToDate : 0;

  const handlePrint = (sectionKey: string) => {
    setPrintSection(sectionKey);
    setTimeout(() => { window.print(); setPrintSection(null); }, 200);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mr-2" />
      <span className="text-sm text-surface-500">Loading results...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Results</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Your semester-by-semester academic record.</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-300 dark:border-surface-600 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
          Print All
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 text-center bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20">
          <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold mb-1">CGPA</p>
          <p className="text-4xl font-extrabold text-primary-600 dark:text-primary-400">{overallGPA.toFixed(2)}</p>
          <p className="text-xs text-surface-400 mt-1">{overallUnits} credit units</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold mb-1">Semesters</p>
          <p className="text-3xl font-bold text-surface-900 dark:text-white">{sections.length}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold mb-1">Approved</p>
          <p className="text-3xl font-bold text-green-600">{results.filter(r => r.status === 'approved').length}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold mb-1">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">{results.filter(r => r.status === 'pending').length}</p>
        </Card>
      </div>

      {sections.length === 0 ? (
        <Card className="p-12 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-3">
            <span className="text-2xl">📚</span>
          </div>
          <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300 mb-1">No results yet</h3>
          <p className="text-sm text-surface-400 max-w-sm">Your results will appear here once lecturers submit and they are approved.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
                  {['S/N', 'Session', 'Semester', 'Courses', 'CGPA (to date)', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map(sec => {
                  const key = `${sec.sessionId}_${sec.semesterId}`;
                  const isExpanded = expandedSection === key;
                  return (
                    <>
                      <tr key={key} className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-surface-500">{sec.sn}</td>
                        <td className="px-4 py-3 font-semibold text-surface-900 dark:text-white">{sec.sessionName}</td>
                        <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{sec.semesterName}</td>
                        <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{sec.results.length}</td>
                        <td className="px-4 py-3 font-bold text-primary-600 dark:text-primary-400">{sec.gpaToDate.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setExpandedSection(isExpanded ? null : key)}
                              className="px-3 py-1 text-xs font-medium rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-surface-700 dark:text-surface-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                            <button onClick={() => handlePrint(key)}
                              className="px-3 py-1 text-xs font-medium rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400 transition-colors">
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${key}_detail`}>
                          <td colSpan={6} className="px-0 py-0 bg-surface-50 dark:bg-surface-800/20">
                            <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                              <p className="text-xs font-semibold text-surface-500 uppercase mb-3">{sec.sessionName} — {sec.semesterName}</p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-surface-200 dark:border-surface-700">
                                    {['Course Code', 'Course Title', 'Units', 'CA (30)', 'Exam (70)', 'Total (100)', 'Grade', 'Status'].map(h => (
                                      <th key={h} className="px-3 py-2 text-left font-semibold text-surface-500 dark:text-surface-400">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                                  {sec.results.map(r => {
                                    const c = courseLookup.get(r.course_id);
                                    const code = r.courseCode || r.course_code || c?.code || r.course_id.slice(0, 8);
                                    const title = r.courseTitle || r.course_title || c?.title || '—';
                                    const units = c?.unit ?? '—';
                                    const ca = parseScore(r.ca_score);
                                    const exam = parseScore(r.exam_score);
                                    const total = parseScore(r.total_score) || (ca + exam);
                                    const grade = (r.grade ?? '—') as string;
                                    const statusCls = r.status === 'approved'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : r.status === 'rejected'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
                                    return (
                                      <tr key={r.id} className="hover:bg-white dark:hover:bg-surface-800/40">
                                        <td className="px-3 py-2 font-semibold font-mono">{code}</td>
                                        <td className="px-3 py-2 max-w-[180px] truncate text-surface-700 dark:text-surface-300">{title}</td>
                                        <td className="px-3 py-2 text-center">{units}</td>
                                        <td className="px-3 py-2 text-center font-mono">{ca}</td>
                                        <td className="px-3 py-2 text-center font-mono">{exam}</td>
                                        <td className="px-3 py-2 text-center font-mono font-semibold">{total}</td>
                                        <td className="px-3 py-2">
                                          <span className="px-2 py-0.5 rounded font-bold text-primary-600 dark:text-primary-400">{grade}</span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusCls}`}>{r.status ?? 'pending'}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              <div className="mt-2 text-right text-xs text-surface-500 font-medium">
                                CGPA to date: <span className="text-primary-600 dark:text-primary-400 font-bold">{sec.gpaToDate.toFixed(2)}</span> ({sec.totalUnitsToDate} units)
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
