import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { Users, BookOpen, GraduationCap } from 'lucide-react';

const matchStats = [
  { name: 'Jan', students: 100 },
  { name: 'Feb', students: 120 },
  { name: 'Mar', students: 150 },
  { name: 'Apr', students: 180 },
];

const AnalyticsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Admin System Analytics</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Monitor system load, student onboarding speed, and course completions.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard title="Active Users" value="280 Active" icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Lecturers" value="18 Staff" icon={<BookOpen className="w-5 h-5" />} />
        <KpiCard title="Graduating Seniors" value="84 Students" icon={<GraduationCap className="w-5 h-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Registrations Trend</CardTitle>
          <CardDescription>Onboarding throughput over past quarters</CardDescription>
        </CardHeader>
        <div className="h-64 p-4 pt-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={matchStats}>
              <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="students" stroke="#0066CC" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
