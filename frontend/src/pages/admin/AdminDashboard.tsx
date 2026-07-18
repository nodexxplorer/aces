import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import RoleBadge from '../../components/data-display/RoleBadge';
import { useNotification } from '../../hooks/useNotification';
import { getDashboardStats, getRecentUsers, getRecentActivity } from '../../api/analytics';
import { Users, BookOpen, MessageSquare, FileText, TrendingUp, Loader2 } from 'lucide-react';
import type { User, UserRole } from '../../types';

const getDisplayName = (u: any) => {
  if (u.fullName) return u.fullName;
  if (u.full_name) return u.full_name;
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return u.email;
};

const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [s, u, a] = await Promise.allSettled([
        getDashboardStats(),
        getRecentUsers(),
        getRecentActivity(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (u.status === 'fulfilled') {
        const items = u.value;
        setRecentUsers(Array.isArray(items) ? items : (items as any).items || []);
      }
      if (a.status === 'fulfilled') {
        const items = a.value;
        setRecentActivity(Array.isArray(items) ? items : (items as any).items || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? stats?.students ?? '—', icon: Users, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Total Courses', value: stats?.totalCourses ?? stats?.courses ?? '—', icon: BookOpen, color: 'text-success-600', bg: 'bg-success-50' },
    { label: 'Active Complaints', value: stats?.activeComplaints ?? stats?.complaints ?? '—', icon: MessageSquare, color: 'text-warning-600', bg: 'bg-warning-50' },
    { label: 'Pending Results', value: stats?.pendingResults ?? stats?.results ?? '—', icon: FileText, color: 'text-danger-600', bg: 'bg-danger-50' },
  ];

  const userColumns = [
    {
      key: 'name',
      label: 'User',
      render: (_: unknown, row: User) => (
        <div>
          <p className="font-semibold">{getDisplayName(row)}</p>
          <p className="text-[10px] text-surface-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (val: unknown, row: any) => <RoleBadge role={(val || row.role) as UserRole} /> },
    { key: 'status', label: 'Status', render: (_: unknown, row: any) => {
      const active = row.isActive ?? row.is_active;
      const approved = row.isApproved ?? row.is_approved;
      return <StatusBadge status={active ? (approved ? 'active' : 'pending') : 'suspended'} />;
    }},
  ];

  const activityColumns = [
    {
      key: 'description',
      label: 'Activity',
      render: (_: unknown, row: any) => (
        <div>
          <p className="text-sm">{row.description || row.action}</p>
          {row.timestamp && <p className="text-[10px] text-surface-500">{new Date(row.timestamp).toLocaleString()}</p>}
        </div>
      ),
    },
    { key: 'type', label: 'Type', render: (val: unknown) => <StatusBadge status={val as string || 'info'} /> },
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
                  <Button size="xs" variant="ghost" onClick={() => window.location.href = '/admin/users'}>
                    View All
                  </Button>
                </div>
                <CardDescription>Newly registered accounts</CardDescription>
              </CardHeader>
              <DataTable columns={userColumns} data={recentUsers.slice(0, 5) as unknown as Record<string, unknown>[]} />
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Activity</CardTitle>
                  <Button size="xs" variant="ghost" onClick={() => window.location.href = '/admin/analytics'}>
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
