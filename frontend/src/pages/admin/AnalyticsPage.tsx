import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { getAnalyticsOverview, getRecentActivity, type AnalyticsOverview } from '../../api/analytics';
import { generateReport, listReports, type GeneratedReport, type ReportType } from '../../api/reports';
import apiClient from '../../api/client';
import {
  TrendingUp,
  Users,
  BookOpen,
  MessageSquare,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Activity,
  ShieldCheck,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const reportTypeLabels: Record<ReportType, string> = {
  grade_distribution: 'Grade Distribution',
  revenue_forecast: 'Revenue Forecast',
  at_risk_students: 'At-Risk Students',
};

// /uploads is a static file mount on the bare server, not under /api/v1 —
// strip the prefix apiClient's baseURL carries.
const uploadsBase = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '');

type RecentActivityItem = {
  id?: string | number;
  description?: string;
  timestamp?: string;
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const reportTypes: ReportType[] = ['grade_distribution', 'revenue_forecast', 'at_risk_students'];

const AnalyticsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(false);

  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [generating, setGenerating] = useState<ReportType | null>(null);

  useEffect(() => {
    fetchData();
    fetchReports();
  }, []);

  const fetchReports = () => {
    setReportsLoading(true);
    listReports()
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]))
      .finally(() => setReportsLoading(false));
  };

  const handleGenerate = async (type: ReportType) => {
    setGenerating(type);
    try {
      await generateReport(type);
      success('Report Generated', `${reportTypeLabels[type]} report is ready to download`);
      fetchReports();
    } catch {
      notifyError('Generation Failed', `Could not generate the ${reportTypeLabels[type]} report`);
    } finally {
      setGenerating(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setAnalyticsError(false);
      const [ov, act] = await Promise.allSettled([getAnalyticsOverview(), getRecentActivity()]);
      if (ov.status === 'fulfilled') setOverview(ov.value);
      else setAnalyticsError(true);
      if (act.status === 'fulfilled') {
        const items = act.value as unknown;
        setRecentActivity(
          Array.isArray(items)
            ? (items as RecentActivityItem[])
            : (items as { items?: RecentActivityItem[] })?.items || [],
        );
      }
    } catch {
      setAnalyticsError(true);
    } finally {
      setLoading(false);
    }
  };

  const kpiCards = overview
    ? [
        {
          label: 'Students',
          value: overview.total_students,
          icon: Users,
          color: 'text-primary-600',
          bg: 'bg-primary-50',
        },
        {
          label: 'Courses',
          value: overview.total_courses,
          icon: BookOpen,
          color: 'text-success-600',
          bg: 'bg-success-50',
        },
        {
          label: 'Revenue',
          value: `₦${overview.total_revenue.toLocaleString()}`,
          icon: DollarSign,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
        },
        {
          label: 'Active Complaints',
          value: overview.open_complaints,
          icon: MessageSquare,
          color: 'text-warning-600',
          bg: 'bg-warning-50',
        },
        { label: 'Results', value: overview.total_results, icon: FileText, color: 'text-info-600', bg: 'bg-info-50' },
        {
          label: 'Pending Payments',
          value: overview.pending_payments,
          icon: AlertTriangle,
          color: 'text-danger-600',
          bg: 'bg-danger-50',
        },
        {
          label: 'Active Users',
          value: overview.active_users,
          icon: ShieldCheck,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
        },
        {
          label: 'Backups',
          value: overview.total_backups,
          icon: Activity,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Analytics Dashboard</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Real-time metrics and insights across the platform.
          </p>
        </div>
        <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={fetchData}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            Exportable Reports
          </CardTitle>
          <CardDescription>Generate a PDF snapshot of a report type, or re-download a past one</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            {reportTypes.map((type) => (
              <Button
                key={type}
                size="sm"
                variant="outline"
                isLoading={generating === type}
                disabled={generating !== null}
                onClick={() => handleGenerate(type)}
              >
                Generate {reportTypeLabels[type]}
              </Button>
            ))}
          </div>

          {reportsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-4">No reports generated yet</p>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-surface-150 dark:border-surface-700"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{r.title}</p>
                    <p className="text-[11px] text-surface-500">
                      {new Date(r.created_at).toLocaleString()} · {r.row_count} rows · {r.status}
                    </p>
                  </div>
                  {r.status === 'completed' && r.file_url && (
                    <a
                      href={`${uploadsBase}/uploads/${r.file_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                    >
                      <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />}>
                        Download
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading analytics...</span>
        </div>
      ) : analyticsError ? (
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-warning-400 mb-3" />
          <p className="text-sm text-surface-600 dark:text-surface-400">
            Failed to load analytics. The database may be unavailable.
          </p>
          <Button variant="outline" className="mt-4" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={fetchData}>
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpiCards.map((s) => (
              <Card key={s.label} className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-surface-900 dark:text-white truncate">{s.value}</p>
                  <p className="text-[10px] text-surface-500">{s.label}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enrollment by Level Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary-500" />
                  Enrollment by Level
                </CardTitle>
                <CardDescription>Student distribution across levels</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0 h-64">
                {overview?.enrollment_by_level && overview.enrollment_by_level.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.enrollment_by_level}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.2)" />
                      <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-surface-400">No data</div>
                )}
              </div>
            </Card>

            {/* CGPA Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success-500" />
                  CGPA Distribution
                </CardTitle>
                <CardDescription>Student performance spread</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0 h-64">
                {overview?.cgpa_distribution && overview.cgpa_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.cgpa_distribution}
                        dataKey="count"
                        nameKey="range"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ payload }) => `${payload?.range}: ${payload?.count}`}
                      >
                        {overview.cgpa_distribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-surface-400">No data</div>
                )}
              </div>
            </Card>

            {/* Complaints by Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-warning-500" />
                  Complaints by Status
                </CardTitle>
                <CardDescription>Current complaint breakdown</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0">
                {overview?.complaints_by_status && overview.complaints_by_status.length > 0 ? (
                  <div className="space-y-3">
                    {overview.complaints_by_status.map((cs) => {
                      const total = overview.total_complaints || 1;
                      const pct = Math.round((cs.count / total) * 100);
                      return (
                        <div key={cs.status}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize font-medium text-surface-700 dark:text-surface-300">
                              {cs.status.replace('_', ' ')}
                            </span>
                            <span className="text-surface-500">
                              {cs.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-100 dark:bg-surface-800">
                            <div
                              className="h-full rounded-full bg-primary-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-surface-400 text-center py-8">No complaints</p>
                )}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-info-500" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest system events</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0 max-h-64 overflow-y-auto">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-surface-400 text-center py-8">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {recentActivity.slice(0, 10).map((item: RecentActivityItem, i: number) => (
                      <div key={item.id || i} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{item.description || 'System event'}</p>
                          <p className="text-[10px] text-surface-400">
                            {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
