import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { getClassRepClassList } from '../../api/class-rep';
import type { ClassRepStudent } from '../../api/class-rep';
import { useNotification } from '../../hooks/useNotification';
import { Search, Loader2, AlertTriangle, Users } from 'lucide-react';

const ClassListPage = () => {
  const { error: notifyError } = useNotification();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getClassRepClassList()
      .then((data) => setStudents(data))
      .catch(() => notifyError('Error', 'Failed to load class list'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.matric_number.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Class List Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Browse students registered in your class level.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name, matric number, or email..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <Users className="w-4 h-4" />
          <span>{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class Members</CardTitle>
          <CardDescription>Roster of students under your level coordination</CardDescription>
        </CardHeader>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading class list...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-surface-400">
            {students.length === 0 ? 'No students found in your class level' : 'No students match your search'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">STUDENT</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">MATRIC NUMBER</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">EMAIL</th>
                  <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {s.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium text-surface-900 dark:text-white">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-600 dark:text-surface-400">
                      {s.matric_number}
                    </td>
                    <td className="px-4 py-3 text-surface-500 text-xs">{s.email}</td>
                    <td className="px-4 py-3">
                      {s.is_defaulter ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-600 dark:text-danger-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> Defaulter
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success-600 dark:text-success-400">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClassListPage;
