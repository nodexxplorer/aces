import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getAlumniDirectory, sendConnectionRequest } from '../../api/campus-connect';
import { Search, UserPlus, Loader2 } from 'lucide-react';

interface Alumnus {
  id: string;
  full_name: string;
  avatar_url?: string;
  email: string;
  graduation_year: number;
  current_company: string;
  current_position: string;
  is_mentor_available: boolean;
}

const AlumniDirectoryPage = () => {
  const { user } = useAuth();
  const { success, error } = useNotification();
  const [search, setSearch] = useState('');
  const [alumni, setAlumni] = useState<Alumnus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlumni = async () => {
      try {
        const data = await getAlumniDirectory();
        setAlumni(Array.isArray(data) ? data : []);
      } catch {
        error('Failed to load', 'Could not fetch alumni directory.');
      } finally {
        setLoading(false);
      }
    };
    fetchAlumni();
  }, [error]);

  const filtered = alumni.filter(
    (a) =>
      a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.current_company?.toLowerCase().includes(search.toLowerCase()) ||
      a.current_position?.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = async (alumnus: Alumnus) => {
    setSendingId(alumnus.id);
    try {
      await sendConnectionRequest(alumnus.id);
      success('Connection Request Sent', `Request sent to ${alumnus.full_name}.`);
    } catch {
      error('Request Failed', 'Could not send connection request.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Browse profiles of graduated engineering alumni working globally.
        </p>
      </div>

      <div className="flex gap-4 max-w-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search alumni..."
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
            Loading alumni...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-surface-400 text-sm">No alumni found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left p-3 font-medium text-surface-500">Name</th>
                  <th className="text-left p-3 font-medium text-surface-500">Graduation Year</th>
                  <th className="text-left p-3 font-medium text-surface-500">Company</th>
                  <th className="text-left p-3 font-medium text-surface-500">Position</th>
                  <th className="text-left p-3 font-medium text-surface-500">Mentor</th>
                  <th className="text-right p-3 font-medium text-surface-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-surface-100 dark:border-surface-800 last:border-0">
                    <td className="p-3 font-medium text-surface-900 dark:text-white">{a.full_name}</td>
                    <td className="p-3 text-surface-600 dark:text-surface-400">
                      {a.graduation_year ? `Class of ${a.graduation_year}` : '—'}
                    </td>
                    <td className="p-3 text-surface-600 dark:text-surface-400">{a.current_company || '—'}</td>
                    <td className="p-3 text-surface-600 dark:text-surface-400">{a.current_position || '—'}</td>
                    <td className="p-3">
                      {a.is_mentor_available ? (
                        <Badge variant="success" dot>Available</Badge>
                      ) : (
                        <Badge variant="outline">Unavailable</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {user?.id !== a.id && (
                        <Button
                          size="xs"
                          variant="outline"
                          leftIcon={sendingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                          onClick={() => handleConnect(a)}
                          disabled={sendingId === a.id}
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

export default AlumniDirectoryPage;
