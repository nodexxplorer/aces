import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import DataTable from '../../components/data-display/DataTable';
import { Users, FileText, Database, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useState } from 'react';

const enrollData = [
  { name: '100L', count: 120 },
  { name: '200L', count: 98 },
  { name: '300L', count: 85 },
  { name: '400L', count: 74 },
  { name: '500L', count: 78 },
];

const mockLogs = [
  { id: '1', action: 'Results Approved', user: 'HOD (Dr. Bassey)', details: 'Approved scores for CPE 511', timestamp: '1 hour ago' },
  { id: '2', action: 'User Signup approval', user: 'Admin', details: 'Approved staff account: Dr. Smith', timestamp: '2 hours ago' },
];

const AdminDashboard = () => {
  const [logs] = useState(mockLogs);

  const columns = [
    { key: 'action', label: 'Action Taken', render: (val: unknown) => <span className="font-semibold">{val as string}</span> },
    { key: 'user', label: 'Operator' },
    { key: 'details', label: 'Log Details' },
    { key: 'timestamp', label: 'Time' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Admin Administration Hub</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Head of Department (HOD) console for academic operations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard title="Total Department Users" value="455 Users" icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Pending Result sheets" value="2 Sheets" icon={<FileText className="w-5 h-5" />} />
        <KpiCard title="Print Jobs Pending" value="4 Files" icon={<Database className="w-5 h-5" />} />
        <KpiCard title="Backup Status" value="Healthy" icon={<ShieldAlert className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Student Level Distribution</CardTitle>
              <CardDescription>Total counts of registered students across classes</CardDescription>
            </CardHeader>
            <div className="h-64 p-4 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => [value, 'Students']} />
                  <Bar dataKey="count" fill="#0066CC" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Activity Logs</CardTitle>
            </CardHeader>
            <DataTable columns={columns} data={logs as unknown as Record<string, unknown>[]} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
