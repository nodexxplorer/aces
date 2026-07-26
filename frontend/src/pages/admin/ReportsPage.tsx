import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { FileText, Download, Users, GraduationCap, AlertCircle, TrendingUp, Loader2, BookOpen } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import apiClient from '../../api/client';

interface DashboardStats {
  total_students: number;
  total_lecturers: number;
  active_courses: number;
  pending_approvals: number;
}

interface GradeDistribution {
  course_code: string;
  course_title: string;
  grade: string;
  count: number;
}

interface AtRiskStudent {
  student_id: string;
  student_name: string;
  matric_number: string;
  risk_level: string;
  gpa: number;
}

interface ClassRepReport {
  id: string;
  report_type: string;
  content: string;
  status: string;
  submitted_at: string;
}

const ReportsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [gradeData, setGradeData] = useState<GradeDistribution[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [classRepReports, setClassRepReports] = useState<ClassRepReport[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, gradeRes, riskRes, reportsRes] = await Promise.allSettled([
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/predictions/grade-distribution'),
        apiClient.get('/predictions/at-risk'),
        apiClient.get('/class-rep/reports/all'),
      ]);

      if (dashRes.status === 'fulfilled') {
        const d = dashRes.value.data?.data || dashRes.value.data;
        setStats(d);
      }
      if (gradeRes.status === 'fulfilled') {
        const g = gradeRes.value.data?.data || gradeRes.value.data;
        setGradeData(Array.isArray(g) ? g : []);
      }
      if (riskRes.status === 'fulfilled') {
        const r = riskRes.value.data?.data || riskRes.value.data;
        setAtRiskStudents(Array.isArray(r?.students) ? r.students : Array.isArray(r) ? r : []);
      }
      if (reportsRes.status === 'fulfilled') {
        const rp = reportsRes.value.data;
        setClassRepReports(Array.isArray(rp) ? rp : []);
      }
    } catch {
      // Partial data is fine
    } finally {
      setLoading(false);
    }
  };

  const generateCSV = (headers: string[], rows: (string | number)[][], filename: string) => {
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    success('Exported', `${filename} downloaded`);
  };

  const handleExportStudents = async () => {
    setGenerating('students');
    try {
      const res = await apiClient.get('/analytics/users', { params: { limit: 500 } });
      const users = res.data?.data || res.data || [];
      const rows = (Array.isArray(users) ? users : []).map((u: any) => [
        u.full_name || '', u.email || '', u.role || '', u.created_at || '',
      ]);
      generateCSV(['Name', 'Email', 'Role', 'Joined'], rows, 'students-report.csv');
    } catch {
      notifyError('Error', 'Failed to export student data');
    } finally {
      setGenerating(null);
    }
  };

  const handleExportGrades = () => {
    setGenerating('grades');
    const rows = gradeData.map((g) => [
      g.course_code || '', g.course_title || '', g.grade || '', g.count || 0,
    ]);
    generateCSV(['Course Code', 'Course Title', 'Grade', 'Count'], rows, 'grade-distribution.csv');
    setGenerating(null);
  };

  const handleExportAtRisk = () => {
    setGenerating('risk');
    const rows = atRiskStudents.map((s) => [
      s.student_name || '', s.matric_number || '', s.risk_level || '', s.gpa || 0,
    ]);
    generateCSV(['Name', 'Matric No.', 'Risk Level', 'GPA'], rows, 'at-risk-students.csv');
    setGenerating(null);
  };

  const handleExportClassRepReports = () => {
    setGenerating('reports');
    const rows = classRepReports.map((r) => [
      r.report_type || '', r.content || '', r.status || '', r.submitted_at || '',
    ]);
    generateCSV(['Type', 'Content', 'Status', 'Submitted At'], rows, 'class-rep-reports.csv');
    setGenerating(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="ml-3 text-sm text-surface-500">Loading report data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Department Reports</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          View live analytics and export departmental records.
        </p>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Students</p>
                <p className="text-xl font-bold text-surface-900 dark:text-white">{stats.total_students ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <GraduationCap className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Lecturers</p>
                <p className="text-xl font-bold text-surface-900 dark:text-white">{stats.total_lecturers ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Courses</p>
                <p className="text-xl font-bold text-surface-900 dark:text-white">{stats.active_courses ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-surface-500">Pending Approvals</p>
                <p className="text-xl font-bold text-surface-900 dark:text-white">{stats.pending_approvals ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-500">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">Student Roster</h3>
              <p className="text-xs text-surface-500 mb-4">
                Complete list of registered students with names, emails, and roles.
              </p>
              <Button
                size="sm"
                leftIcon={generating === 'students' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                onClick={handleExportStudents}
                disabled={generating === 'students'}
              >
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-green-500">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">Grade Distribution</h3>
              <p className="text-xs text-surface-500 mb-4">
                Breakdown of grades by course. {gradeData.length > 0 ? `${gradeData.length} records available.` : 'No grade data yet.'}
              </p>
              <Button
                size="sm"
                leftIcon={generating === 'grades' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                onClick={handleExportGrades}
                disabled={generating === 'grades' || gradeData.length === 0}
              >
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-red-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">At-Risk Students</h3>
              <p className="text-xs text-surface-500 mb-4">
                Students identified as at-risk based on GPA and performance. {atRiskStudents.length > 0 ? `${atRiskStudents.length} students.` : 'None identified.'}
              </p>
              <Button
                size="sm"
                leftIcon={generating === 'risk' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                onClick={handleExportAtRisk}
                disabled={generating === 'risk' || atRiskStudents.length === 0}
              >
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-500">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">Class Rep Reports</h3>
              <p className="text-xs text-surface-500 mb-4">
                All reports submitted by class representatives. {classRepReports.length > 0 ? `${classRepReports.length} reports.` : 'No reports yet.'}
              </p>
              <Button
                size="sm"
                leftIcon={generating === 'reports' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                onClick={handleExportClassRepReports}
                disabled={generating === 'reports' || classRepReports.length === 0}
              >
                Export CSV
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
