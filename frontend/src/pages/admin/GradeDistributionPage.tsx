import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { getGradeDistribution } from '../../api/predictions';
import type { GradeDistribution } from '../../api/predictions';
import { BarChart3 } from 'lucide-react';

const gradeBarColors = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444', '#dc2626'];

const GradeDistributionPage = () => {
  const [data, setData] = useState<GradeDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGradeDistribution()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (data.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grade Distribution Analysis</h1>
        <Card className="p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-surface-300 mb-4" />
          <p className="text-surface-500">No grade data available yet. Distributions will appear once results are published.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Grade Distribution Analysis</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          AI-powered analysis of class performance across all courses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.map((course) => {
          const chartData = [
            { grade: 'A', count: course.grade_a, fill: gradeBarColors[0] },
            { grade: 'B', count: course.grade_b, fill: gradeBarColors[1] },
            { grade: 'C', count: course.grade_c, fill: gradeBarColors[2] },
            { grade: 'D', count: course.grade_d, fill: gradeBarColors[3] },
            { grade: 'E', count: course.grade_e, fill: gradeBarColors[4] },
            { grade: 'F', count: course.grade_f, fill: gradeBarColors[5] },
          ];

          return (
            <Card key={course.course_id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{course.course_code}</span>
                  <span className="text-sm font-normal text-surface-400">{course.total_students} students</span>
                </CardTitle>
                <CardDescription>{course.course_name}</CardDescription>
              </CardHeader>
              <div className="p-4 pt-0">
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-surface-900 dark:text-white">{course.avg_score.toFixed(1)}</div>
                    <div className="text-[11px] text-surface-400">Avg Score</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${course.pass_rate >= 70 ? 'text-success-500' : course.pass_rate >= 50 ? 'text-yellow-500' : 'text-danger-500'}`}>
                      {course.pass_rate}%
                    </div>
                    <div className="text-[11px] text-surface-400">Pass Rate</div>
                  </div>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {course.pass_rate < 50 && (
                  <div className="mt-2 p-2 rounded-lg bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-800 text-xs text-danger-600 dark:text-danger-400">
                    ⚠ Low pass rate. AI recommends remedial sessions for this course.
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default GradeDistributionPage;
