import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import RoleBadge from '../../components/data-display/RoleBadge';
import { getDashboardAnalytics as getDashboardStats, getRecentUsers, getRecentActivity } from '../../api/analytics';
import { Users, BookOpen, MessageSquare, FileText, TrendingUp, Loader2 } from 'lucide-react';
import type { UserRole } from '../../types';

// getRecentUsers() returns a lightweight summary, not a full User record —
// only these fields (plus optional legacy status fields some backend
// revisions included) actually exist on the response.
interface RecentUserRow {
  id: string;
  fullName?: string;
  full_name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  createdAt?: string;
  is_active?: boolean;
  is_approved?: boolean;
  isActive?: boolean;
  isApproved?: boolean;
}

const getDisplayName = (u: RecentUserRow) => {
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.email;
};

// The dashboard summary endpoint has historically returned slightly
// different field names across backend revisions; these optional fallbacks
// keep the stat cards resilient without asserting `any`.
interface DashboardStats {
  totalUsers?: number;
  students?: number;
  totalCourses?: number;
  courses?: number;
  activeComplaints?: number;
  complaints?: number;
  pendingResults?: number;
  results?: number;
  performanceTrend?: string;
}

// Same tolerance for the "recent activity" feed: the row shape can carry
// either a `message`/`createdAt` pair or a legacy `description`/`action`/
// `timestamp` set depending on the source event.
interface ActivityItem {
  id?: string;
  type?: string;
  message?: string;
  description?: string;
  action?: string;
  timestamp?: string;
  createdAt?: string;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUserRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, u, a] = await Promise.allSettled([getDashboardStats(), getRecentUsers(), getRecentActivity()]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (u.status === 'fulfilled') {
        const items = u.value;
        setRecentUsers(Array.isArray(items) ? items : (items as unknown as { items?: RecentUserRow[] }).items || []);
      }
      if (a.status === 'fulfilled') {
        const items = a.value;
        setRecentActivity(Array.isArray(items) ? items : (items as unknown as { items?: ActivityItem[] }).items || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? stats?.students ?? '—',
      icon: Users,
      color: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      label: 'Total Courses',
      value: stats?.totalCourses ?? stats?.courses ?? '—',
      icon: BookOpen,
      color: 'text-success-600',
      bg: 'bg-success-50',
    },
    {
      label: 'Active Complaints',
      value: stats?.activeComplaints ?? stats?.complaints ?? '—',
      icon: MessageSquare,
      color: 'text-warning-600',
      bg: 'bg-warning-50',
    },
    {
      label: 'Pending Results',
      value: stats?.pendingResults ?? stats?.results ?? '—',
      icon: FileText,
      color: 'text-danger-600',
      bg: 'bg-danger-50',
    },
  ];

  const userColumns = [
    {
      key: 'name',
      label: 'User',
      render: (_: unknown, row: RecentUserRow) => (
        <div>
          <p className="font-semibold">{getDisplayName(row)}</p>
          <p className="text-[10px] text-surface-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (val: unknown, row: RecentUserRow) => <RoleBadge role={(val || row.role) as UserRole} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: unknown, row: RecentUserRow) => {
        const active = row.isActive ?? row.is_active;
        const approved = row.isApproved ?? row.is_approved;
        return <StatusBadge status={active ? (approved ? 'active' : 'pending') : 'suspended'} />;
      },
    },
  ];

  const activityColumns = [
    {
      key: 'description',
      label: 'Activity',
      render: (_: unknown, row: ActivityItem) => (
        <div>
          <p className="text-sm">{row.description || row.action}</p>
          {row.timestamp && <p className="text-[10px] text-surface-500">{new Date(row.timestamp).toLocaleString()}</p>}
        </div>
      ),
    },
    { key: 'type', label: 'Type', render: (val: unknown) => <StatusBadge status={(val as string) || 'info'} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Administration Dashboard</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          System overview and recent activity for the current academic session.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading dashboard...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((s) => (
              <Card key={s.label} className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-surface-900 dark:text-white">{s.value}</p>
                  <p className="text-xs text-surface-500">{s.label}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Users</CardTitle>
                  <Button size="xs" variant="ghost" onClick={() => (window.location.href = '/admin/users')}>
                    View All
                  </Button>
                </div>
                <CardDescription>Newly registered accounts</CardDescription>
              </CardHeader>
              <DataTable columns={userColumns} data={recentUsers.slice(0, 5)} />
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Activity</CardTitle>
                  <Button size="xs" variant="ghost" onClick={() => (window.location.href = '/admin/analytics')}>
                    Full Analytics
                  </Button>
                </div>
                <CardDescription>Latest system events</CardDescription>
              </CardHeader>
              <DataTable columns={activityColumns} data={recentActivity.slice(0, 5)} />
            </Card>
          </div>

          {stats?.performanceTrend && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-500" />
                  Performance Trend
                </CardTitle>
              </CardHeader>
              <div className="p-4 pt-0">
                <p className="text-sm text-surface-600">{stats.performanceTrend}</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
