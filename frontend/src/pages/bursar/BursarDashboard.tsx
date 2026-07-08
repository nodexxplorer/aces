import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { formatCurrency } from '../../utils/formatters';
import { useNotification } from '../../hooks/useNotification';
import { DollarSign, Users, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useState } from 'react';

const trendData = [
  { name: 'Jan', amount: 120000 },
  { name: 'Feb', amount: 250000 },
  { name: 'Mar', amount: 480000 },
  { name: 'Apr', amount: 720000 },
  { name: 'May', amount: 980000 },
  { name: 'Jun', amount: 145000 },
];

const mockRecentPayments = [
  { id: '1', studentName: 'John Doe', matricNumber: 'ENG/2021/001', purpose: 'Department Dues', amount: 15000, reference: 'PAYSTACK-REF-01', status: 'completed', createdAt: '2026-06-20T12:00:00Z' },
  { id: '2', studentName: 'Jane Smith', matricNumber: 'ENG/2021/002', purpose: 'Class Dues', amount: 5000, reference: 'PAYSTACK-REF-02', status: 'completed', createdAt: '2026-06-20T13:00:00Z' },
];

const BursarDashboard = () => {
  const { success } = useNotification();
  const [payments] = useState(mockRecentPayments);

  const columns = [
    { key: 'studentName', label: 'Student', render: (_: unknown, row: any) => <div><p className="font-semibold">{row.studentName}</p><p className="text-[10px] text-surface-500">{row.matricNumber}</p></div> },
    { key: 'purpose', label: 'Purpose' },
    { key: 'amount', label: 'Amount', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Bursar Management Portal</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Monitor fee collections, audit transaction references, and manage financial logs.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Total Dues Collected" value={formatCurrency(2685000)} icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="Cleared Students" value="142 Students" icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Active Defaulters" value="20 Students" icon={<ShieldAlert className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Collection Analytics</CardTitle>
              <CardDescription>Monthly dues receipt values (NGN)</CardDescription>
            </CardHeader>
            <div className="h-64 p-4 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066CC" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0066CC" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${v / 1000}k`} />
                  <Tooltip formatter={(value) => [`₦${value}`, 'Amount']} />
                  <Area type="monotone" dataKey="amount" stroke="#0066CC" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
            </CardHeader>
            <DataTable columns={columns} data={payments as unknown as Record<string, unknown>[]} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BursarDashboard;
