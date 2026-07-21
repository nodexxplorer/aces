import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getGPAPrediction } from '../../api/predictions';
import type { GPAPrediction, GPAGrade } from '../../api/predictions';
import { TrendingUp, BookOpen, Award, AlertTriangle } from 'lucide-react';

const gradeColors: Record<string, string> = {
  A: '#22c55e', B: '#3b82f6', C: '#eab308', D: '#f97316', E: '#ef4444', F: '#dc2626',
};

const GPAPredictionPage = () => {
  const [data, setData] = useState<GPAPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getGPAPrediction()
      .then(setData)
      .catch(() => setError('Failed to load GPA prediction'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="text-center py-12 text-danger-500">{error}</div>;
  if (!data || data.grades.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">GPA Predictor</h1>
        <Card className="p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-surface-300 mb-4" />
          <p className="text-surface-500">No grade data available yet. Your GPA prediction will appear once results are published.</p>
        </Card>
      </div>
    );
  }

  const chartData = data.grades.map((g: GPAGrade) => ({
    name: g.course_code,
    score: g.total_score,
    grade: g.grade_letter,
    credits: g.credits,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">GPA Predictor</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Predicted GPA based on your current grades and credit units.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard title="Predicted GPA" value={data.predicted_gpa.toFixed(2)} icon={<TrendingUp className="w-5 h-5" />} />
        <KpiCard title="Total Credits" value={String(data.total_credits)} icon={<BookOpen className="w-5 h-5" />} />
        <KpiCard title="Courses Graded" value={String(data.total_courses)} icon={<Award className="w-5 h-5" />} />
        <KpiCard
          title="Academic Standing"
          value={data.predicted_gpa >= 3.5 ? 'Excellent' : data.predicted_gpa >= 2.5 ? 'Good' : data.predicted_gpa >= 1.5 ? 'Fair' : 'At Risk'}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
          <CardDescription>Your scores and predicted grade for each course</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={gradeColors[entry.grade] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grade Breakdown</CardTitle>
        </CardHeader>
        <div className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left py-2 font-medium text-surface-500">Course</th>
                  <th className="text-center py-2 font-medium text-surface-500">Credits</th>
                  <th className="text-center py-2 font-medium text-surface-500">Score</th>
                  <th className="text-center py-2 font-medium text-surface-500">Grade Points</th>
                  <th className="text-center py-2 font-medium text-surface-500">Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.grades.map((g: GPAGrade, i: number) => (
                  <tr key={i} className="border-b border-surface-100 dark:border-surface-800">
                    <td className="py-2 font-medium">{g.course_code}</td>
                    <td className="text-center py-2">{g.credits}</td>
                    <td className="text-center py-2">{g.total_score}</td>
                    <td className="text-center py-2">{g.grade_points.toFixed(1)}</td>
                    <td className="text-center py-2">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: gradeColors[g.grade_letter] || '#94a3b8' }}>
                        {g.grade_letter}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default GPAPredictionPage;
