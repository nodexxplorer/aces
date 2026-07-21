import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import { getAtRiskStudents } from '../../api/predictions';
import type { AtRiskStudent } from '../../api/predictions';
import { AlertTriangle, Users, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '../../utils/cn';

const riskColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const AtRiskDashboard = () => {
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    getAtRiskStudents(50)
      .then((data) => {
        setStudents(data.students || []);
        setStats(data.stats || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? students : students.filter((s) => s.risk_level === filter);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">At-Risk Student Alerts</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Students flagged for academic, attendance, or financial risk. Requires intervention.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KpiCard title="Critical" value={String(stats.critical || 0)} icon={<AlertTriangle className="w-5 h-5" />} />
        <KpiCard title="High Risk" value={String(stats.high || 0)} icon={<TrendingDown className="w-5 h-5" />} />
        <KpiCard title="Medium Risk" value={String(stats.medium || 0)} icon={<Users className="w-5 h-5" />} />
        <KpiCard title="Low Risk" value={String(stats.low || 0)} icon={<DollarSign className="w-5 h-5" />} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'critical', 'high', 'medium', 'low'].map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
              filter === level
                ? "bg-primary-500 text-white border-primary-500"
                : "bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700"
            )}
          >
            {level === 'all' ? `All (${students.length})` : `${level.charAt(0).toUpperCase() + level.slice(1)} (${stats[level] || 0})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-surface-500">No students match this filter. All students are on track.</p>
        </Card>
      ) : (
        <Card>
          <div className="p-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-2 font-medium text-surface-500">Student</th>
                    <th className="text-center py-2 font-medium text-surface-500">Level</th>
                    <th className="text-center py-2 font-medium text-surface-500">CGPA</th>
                    <th className="text-center py-2 font-medium text-surface-500">Attendance</th>
                    <th className="text-center py-2 font-medium text-surface-500">Failing</th>
                    <th className="text-center py-2 font-medium text-surface-500">Outstanding</th>
                    <th className="text-center py-2 font-medium text-surface-500">Risk</th>
                    <th className="text-left py-2 font-medium text-surface-500">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.student_id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                      <td className="py-2">
                        <div className="font-medium">{s.full_name}</div>
                        <div className="text-xs text-surface-400">{s.matric_number}</div>
                      </td>
                      <td className="text-center py-2">{s.level}00L</td>
                      <td className="text-center py-2 font-mono">{s.cgpa.toFixed(2)}</td>
                      <td className="text-center py-2">
                        <span className={cn("font-mono", s.attendance_rate < 50 ? "text-danger-500" : s.attendance_rate < 70 ? "text-yellow-500" : "text-success-500")}>
                          {s.attendance_rate.toFixed(0)}%
                        </span>
                      </td>
                      <td className="text-center py-2">
                        {s.failing_count > 0 ? <span className="text-danger-500 font-bold">{s.failing_count}</span> : <span className="text-surface-400">0</span>}
                      </td>
                      <td className="text-center py-2 font-mono">
                        {s.outstanding_dues > 0 ? <span className="text-yellow-600">₦{s.outstanding_dues.toLocaleString()}</span> : <span className="text-surface-400">—</span>}
                      </td>
                      <td className="text-center py-2">
                        <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize", riskColors[s.risk_level])}>
                          {s.risk_level}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-surface-500 max-w-[200px]">{s.risk_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AtRiskDashboard;
