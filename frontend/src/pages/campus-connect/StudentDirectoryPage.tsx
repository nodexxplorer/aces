import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getStudentDirectory, sendConnectionRequest } from '../../api/campus-connect';
import { Search, UserPlus, Loader2 } from 'lucide-react';

interface Student {
  id: string;
  full_name: string;
  avatar_url?: string;
  email: string;
  matric_number: string;
  level: number;
}

const StudentDirectoryPage = () => {
  const { user } = useAuth();
  const { success, error } = useNotification();
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await getStudentDirectory();
        setStudents(data);
      } catch {
        error('Failed to load', 'Could not fetch student directory.');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [error]);

  const filtered = students.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.matric_number?.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = async (student: Student) => {
    setSendingId(student.id);
    try {
      await sendConnectionRequest(student.id);
      success('Connection Request Sent', `Request sent to ${student.full_name}.`);
    } catch {
      error('Request Failed', 'Could not send connection request.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Student Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Browse students across classes, levels, and study groups.
        </p>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-surface-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading students...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-surface-400 text-sm">No students found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left p-3 font-medium text-surface-500">Name</th>
                  <th className="text-left p-3 font-medium text-surface-500">Matric Number</th>
                  <th className="text-left p-3 font-medium text-surface-500">Level</th>
                  <th className="text-right p-3 font-medium text-surface-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-surface-100 dark:border-surface-800 last:border-0">
                    <td className="p-3 font-medium text-surface-900 dark:text-white">{s.full_name}</td>
                    <td className="p-3 text-surface-600 dark:text-surface-400">{s.matric_number}</td>
                    <td className="p-3 text-surface-600 dark:text-surface-400">{s.level ? `${s.level}00 Level` : '—'}</td>
                    <td className="p-3 text-right">
                      {user?.id !== s.id && (
                        <Button
                          size="xs"
                          variant="outline"
                          leftIcon={sendingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                          onClick={() => handleConnect(s)}
                          disabled={sendingId === s.id}
                        >
                          Connect
                        </Button>
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

export default StudentDirectoryPage;
