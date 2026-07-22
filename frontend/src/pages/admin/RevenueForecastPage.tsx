import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getRevenueForecast } from '../../api/predictions';
import type { RevenueForecast } from '../../api/predictions';
import { DollarSign, TrendingUp, PieChart, Target } from 'lucide-react';

const formatNaira = (v: number) => `₦${v.toLocaleString()}`;

const RevenueForecastPage = () => {
  const [data, setData] = useState<RevenueForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRevenueForecast()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <div className="text-center py-12 text-surface-500">No revenue data available</div>;

  const chartData = [
    { name: 'Collected', value: data.total_collected, fill: '#22c55e' },
    { name: 'Expected', value: data.total_expected, fill: '#e2e8f0' },
    { name: 'Projected', value: data.projected_next_month, fill: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Revenue Forecast</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          AI-powered revenue projections based on historical payment data.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard title="Total Collected" value={formatNaira(data.total_collected)} icon={<DollarSign className="w-5 h-5" />} />
        <KpiCard title="Projected Next Month" value={formatNaira(data.projected_next_month)} icon={<TrendingUp className="w-5 h-5" />} />
        <KpiCard title="Collection Rate" value={`${data.collection_rate.toFixed(1)}%`} icon={<PieChart className="w-5 h-5" />} />
        <KpiCard title="Total Expected" value={formatNaira(data.total_expected)} icon={<Target className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Collected vs Expected vs Projected</CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatNaira(Number(v))} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Statistics</CardTitle>
            <CardDescription>Based on {data.months_with_data} months of data</CardDescription>
          </CardHeader>
          <div className="p-4 pt-0 space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
              <span className="text-sm text-surface-500">Average Monthly Revenue</span>
              <span className="font-semibold">{formatNaira(data.avg_monthly)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
              <span className="text-sm text-surface-500">Highest Month</span>
              <span className="font-semibold text-success-500">{formatNaira(data.max_monthly)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
              <span className="text-sm text-surface-500">Lowest Month</span>
              <span className="font-semibold text-danger-500">{formatNaira(data.min_monthly)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
              <span className="text-sm text-surface-500">Semester Total</span>
              <span className="font-semibold">{formatNaira(data.semester_total)}</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-800">
              <span className="text-sm font-medium text-primary-700 dark:text-primary-400">AI Projected Next Month</span>
              <span className="font-bold text-primary-600 dark:text-primary-300">{formatNaira(data.projected_next_month)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RevenueForecastPage;
