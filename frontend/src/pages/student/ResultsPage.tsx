import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import GradeBadge from '../../components/data-display/GradeBadge';
import { getStudentResults } from '../../api/results';
import { getCourses } from '../../api/courses';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import Button from '../../components/ui/Button';
import { Printer, BookOpen, Loader2 } from 'lucide-react';
import type { Course } from '../../types';

interface RawResult {
  id: string;
  student_id?: string;
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
  // Admin list fields (when joined)
  courseCode?: string;
  courseTitle?: string;
  course_code?: string;
  course_title?: string;
}

const ResultsPage = () => {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [results, setResults] = useState<RawResult[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      getStudentResults(user.id).catch(() => []),
      getCourses().catch(() => []),
    ])
      .then(([res, crs]) => {
        setResults(Array.isArray(res) ? (res as unknown as RawResult[]) : []);
        setCourses(Array.isArray(crs) ? crs : []);
      })
      .catch(() => notifyError('Error', 'Failed to load results'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Build course lookup
  const courseLookup = new Map(courses.map((c) => [c.id, c]));

  const parseScore = (v: number | string | undefined): number => {
    if (v === undefined || v === null) return 0;
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNaN(n) ? 0 : n;
  };

  // Compute GPA across all results
  const totalGradePoints = results.reduce((sum, r) => {
    const course = courseLookup.get(r.course_id);
    const units = course?.unit ?? 0;
    const gp = parseScore(r.grade_point);
    return sum + units * gp;
  }, 0);
  const totalUnits = results.reduce((sum, r) => {
    const course = courseLookup.get(r.course_id);
    return sum + (course?.unit ?? 0);
  }, 0);
  const gpa = totalUnits > 0 ? totalGradePoints / totalUnits : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Results</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Your semester-by-semester academic scores.
          </p>
        </div>
        <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
          Print Results
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="text-center p-6 bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20">
          <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">
            Cumulative GPA
          </h4>
          <p className="text-5xl font-extrabold text-primary-600 dark:text-primary-400">
            {gpa.toFixed(2)}
          </p>
          <p className="text-xs text-surface-400 mt-2">{totalUnits} total credit units</p>
        </Card>

        <Card className="text-center p-6 md:col-span-3 flex flex-col justify-center">
          <div className="grid grid-cols-3 divide-x divide-surface-200 dark:divide-surface-700">
            <div className="px-4 text-center">
              <p className="text-2xl font-bold text-surface-900 dark:text-white">{results.length}</p>
              <p className="text-xs text-surface-400 mt-1">Courses Recorded</p>
            </div>
            <div className="px-4 text-center">
              <p className="text-2xl font-bold text-green-600">{results.filter(r => r.status === 'approved').length}</p>
              <p className="text-xs text-surface-400 mt-1">Approved</p>
            </div>
            <div className="px-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{results.filter(r => r.status === 'pending').length}</p>
              <p className="text-xs text-surface-400 mt-1">Pending</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grades</CardTitle>
          <CardDescription>All recorded scores for your courses</CardDescription>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500 mr-2" />
            <span className="text-sm text-surface-500">Loading results...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <BookOpen className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-3" />
            <h3 className="text-base font-semibold text-surface-700 dark:text-surface-300 mb-1">No results yet</h3>
            <p className="text-sm text-surface-400 max-w-sm">
              Your results will appear here once your lecturers submit and they are approved.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  {['Course Code', 'Course Title', 'Units', 'CA (30)', 'Exam (70)', 'Total (100)', 'Grade', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                {results.map((r) => {
                  const course = courseLookup.get(r.course_id);
                  const code = r.courseCode || r.course_code || course?.code || r.course_id.slice(0, 8);
                  const title = r.courseTitle || r.course_title || course?.title || '—';
                  const units = course?.unit ?? '—';
                  const ca = parseScore(r.ca_score);
                  const exam = parseScore(r.exam_score);
                  const total = parseScore(r.total_score);
                  const grade = (r.grade ?? '—') as string;
                  const statusColor = r.status === 'approved'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : r.status === 'rejected'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
                  return (
                    <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-surface-900 dark:text-white font-mono text-xs">{code}</td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300 max-w-[200px] truncate">{title}</td>
                      <td className="px-4 py-3 text-center text-surface-700 dark:text-surface-300">{units}</td>
                      <td className="px-4 py-3 text-center font-mono">{ca}</td>
                      <td className="px-4 py-3 text-center font-mono">{exam}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold">{total}</td>
                      <td className="px-4 py-3">
                        {grade !== '—' ? (
                          <GradeBadge grade={grade as 'A' | 'B' | 'C' | 'D' | 'E' | 'F'} />
                        ) : <span className="text-surface-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColor}`}>
                          {r.status ?? 'pending'}
                        </span>
                      </td>
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

export default ResultsPage;
