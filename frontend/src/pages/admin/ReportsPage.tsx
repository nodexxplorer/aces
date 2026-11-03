import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  FileText,
  Download,
  Users,
  GraduationCap,
  AlertCircle,
  TrendingUp,
  Loader2,
  BookOpen,
  Eye,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import apiClient from '../../api/client';
import { listAllReports, updateReportStatus, type ClassRepReport } from '../../api/class-rep';
import { getErrorMessage } from '../../utils/errors';

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

interface ExportableUser {
  full_name?: string;
  email?: string;
  role?: string;
  created_at?: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'draft', label: 'Draft' },
];

const ReportsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [gradeData, setGradeData] = useState<GradeDistribution[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [classRepReports, setClassRepReports] = useState<ClassRepReport[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);

  // Class rep reports UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'class-rep-reports'>('overview');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingReport, setUpdatingReport] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, gradeRes, riskRes, reportsData] = await Promise.allSettled([
        apiClient.get('/analytics/dashboard'),
        apiClient.get('/predictions/grade-distribution'),
        apiClient.get('/predictions/at-risk'),
        listAllReports(),
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
      if (reportsData.status === 'fulfilled') {
        setClassRepReports(Array.isArray(reportsData.value) ? reportsData.value : []);
      }
    } catch {
      // Partial data is fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

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
      const rows = (Array.isArray(users) ? users : []).map((u: ExportableUser) => [
        u.full_name || '',
        u.email || '',
        u.role || '',
        u.created_at || '',
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
    const rows = gradeData.map((g) => [g.course_code || '', g.course_title || '', g.grade || '', g.count || 0]);
    generateCSV(['Course Code', 'Course Title', 'Grade', 'Count'], rows, 'grade-distribution.csv');
    setGenerating(null);
  };

  const handleExportAtRisk = () => {
    setGenerating('risk');
    const rows = atRiskStudents.map((s) => [
      s.student_name || '',
      s.matric_number || '',
      s.risk_level || '',
      s.gpa || 0,
    ]);
    generateCSV(['Name', 'Matric No.', 'Risk Level', 'GPA'], rows, 'at-risk-students.csv');
    setGenerating(null);
  };

  const handleExportClassRepReports = () => {
    setGenerating('reports');
    const rows = classRepReports.map((r) => [
      r.report_type || '',
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.content || '').replace(/"/g, '""')}"`,
      r.status || '',
      r.class_rep_name || '',
      r.created_at || '',
    ]);
    generateCSV(['Type', 'Title', 'Content', 'Status', 'Submitted By', 'Submitted At'], rows, 'class-rep-reports.csv');
    setGenerating(null);
  };

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    setUpdatingReport(reportId);
    try {
      await updateReportStatus(reportId, newStatus);
      // Update local state
      setClassRepReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r)));
      success('Updated', `Report marked as ${newStatus}`);
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to update report status'));
    } finally {
      setUpdatingReport(null);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolved
        </span>
      );
    }
    if (s === 'reviewed' || s === 'seen') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
          <Eye className="w-3.5 h-3.5" />
          Reviewed
        </span>
      );
    }
    if (s === 'submitted' || s === 'delivered' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
          <Clock className="w-3.5 h-3.5" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-600">
        <Clock className="w-3.5 h-3.5" />
        {status || 'Draft'}
      </span>
    );
  };

  const getReportTypeBadge = (type: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      attendance: { label: 'Attendance', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
      concern: { label: 'Concern', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
      event: { label: 'Event', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
      other: { label: 'Other', color: 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300' },
    };
    const info = labels[type.toLowerCase()] || labels.other;
    return <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${info.color}`}>{info.label}</span>;
  };

  // Filter reports
  const filteredReports = classRepReports.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.class_rep_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.report_type?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || r.status?.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = classRepReports.filter((r) =>
    ['submitted', 'delivered', 'pending'].includes(r.status?.toLowerCase()),
  ).length;

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Department Reports</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            View live analytics, class rep submissions, and export departmental records.
          </p>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={() => setActiveTab('class-rep-reports')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            {pendingCount} pending report{pendingCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          Overview & Exports
        </button>
        <button
          onClick={() => setActiveTab('class-rep-reports')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'class-rep-reports'
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
              : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          Class Rep Reports
          {classRepReports.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
              {classRepReports.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
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
                    leftIcon={
                      generating === 'students' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )
                    }
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
                    Breakdown of grades by course.{' '}
                    {gradeData.length > 0 ? `${gradeData.length} records available.` : 'No grade data yet.'}
                  </p>
                  <Button
                    size="sm"
                    leftIcon={
                      generating === 'grades' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )
                    }
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
                    Students identified as at-risk based on GPA and performance.{' '}
                    {atRiskStudents.length > 0 ? `${atRiskStudents.length} students.` : 'None identified.'}
                  </p>
                  <Button
                    size="sm"
                    leftIcon={
                      generating === 'risk' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )
                    }
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
                    All reports submitted by class representatives.{' '}
                    {classRepReports.length > 0 ? `${classRepReports.length} reports.` : 'No reports yet.'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      leftIcon={
                        generating === 'reports' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )
                      }
                      onClick={handleExportClassRepReports}
                      disabled={generating === 'reports' || classRepReports.length === 0}
                    >
                      Export CSV
                    </Button>
                    {classRepReports.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<Eye className="w-4 h-4" />}
                        onClick={() => setActiveTab('class-rep-reports')}
                      >
                        View All
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'class-rep-reports' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reports by title, content, or rep name..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2.5 text-sm rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              leftIcon={
                generating === 'reports' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )
              }
              onClick={handleExportClassRepReports}
              disabled={generating === 'reports' || classRepReports.length === 0}
            >
              Export CSV
            </Button>
          </div>

          {/* Reports List */}
          {filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-800 p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-surface-400 mx-auto mb-4">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-white mb-1">
                {classRepReports.length === 0 ? 'No class rep reports yet' : 'No reports match your filters'}
              </h3>
              <p className="text-sm text-surface-500">
                {classRepReports.length === 0
                  ? 'Reports submitted by class representatives will appear here.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const isExpanded = expandedReport === report.id;
                return (
                  <div
                    key={report.id}
                    className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden transition-all"
                  >
                    {/* Report Header Row */}
                    <button
                      onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 dark:hover:bg-surface-750 transition-colors"
                    >
                      <div className="p-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-primary-500 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-surface-900 dark:text-white truncate">
                            {report.title || 'Untitled Report'}
                          </span>
                          {getReportTypeBadge(report.report_type)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-surface-500">
                          {report.class_rep_name && <span>By {report.class_rep_name}</span>}
                          {report.level > 0 && <span>• Level {report.level}</span>}
                          <span>• {formatDate(report.created_at)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        {getStatusBadge(report.status)}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-surface-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-surface-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-surface-100 dark:border-surface-700">
                        <div className="pt-4 space-y-4">
                          {/* Report Content */}
                          <div>
                            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                              Report Details
                            </h4>
                            <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900/50 text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">
                              {report.content || 'No content provided.'}
                            </div>
                          </div>

                          {/* Review Notes */}
                          {report.review_notes && (
                            <div>
                              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
                                Review Notes
                              </h4>
                              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap">
                                {report.review_notes}
                              </div>
                            </div>
                          )}

                          {/* Meta Info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-900/50">
                              <span className="text-surface-500 block mb-0.5">Type</span>
                              <span className="font-medium text-surface-900 dark:text-white capitalize">
                                {report.report_type}
                              </span>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-900/50">
                              <span className="text-surface-500 block mb-0.5">Level</span>
                              <span className="font-medium text-surface-900 dark:text-white">
                                {report.level > 0 ? report.level : '—'}
                              </span>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-900/50">
                              <span className="text-surface-500 block mb-0.5">Academic Year</span>
                              <span className="font-medium text-surface-900 dark:text-white">
                                {report.academic_year || '—'}
                              </span>
                            </div>
                            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-900/50">
                              <span className="text-surface-500 block mb-0.5">Submitted</span>
                              <span className="font-medium text-surface-900 dark:text-white">
                                {formatDate(report.created_at)}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-2">
                            {report.status?.toLowerCase() !== 'reviewed' &&
                              report.status?.toLowerCase() !== 'resolved' && (
                                <button
                                  onClick={() => handleUpdateStatus(report.id, 'reviewed')}
                                  disabled={updatingReport === report.id}
                                  className="px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                  {updatingReport === report.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                  Mark as Reviewed
                                </button>
                              )}
                            {report.status?.toLowerCase() !== 'resolved' && (
                              <button
                                onClick={() => handleUpdateStatus(report.id, 'resolved')}
                                disabled={updatingReport === report.id}
                                className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                {updatingReport === report.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                Mark as Resolved
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
