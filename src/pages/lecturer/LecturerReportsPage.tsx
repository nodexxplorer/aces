import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const gradeDistribution = [
  { grade: 'A', count: 12 },
  { grade: 'B', count: 24 },
  { grade: 'C', count: 30 },
  { grade: 'D', count: 10 },
  { grade: 'F', count: 4 },
];

const LecturerReportsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Lecturer Academic Reports</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review class grade distributions and performance statistics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CPE 511 Grade Distribution</CardTitle>
            <CardDescription>Visual summary of final grade outcomes</CardDescription>
          </CardHeader>
          <div className="h-64 p-4 pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution}>
                <XAxis dataKey="grade" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [value, 'Students']} />
                <Bar dataKey="count" fill="#0066CC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LecturerReportsPage;
