import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { getMyGroups, leaveGroup } from '../../api/campus-connect';
import { Link } from 'react-router-dom';
import { Users, Loader2, LogOut } from 'lucide-react';
import type { Group } from '../../types';

interface GroupData {
  id: string;
  name: string;
  description?: string;
  category: string;
  is_private: boolean;
  member_count?: number;
  role?: string;
}

const normalizeGroupData = (group: Group): GroupData => ({
  id: group.id,
  name: group.name,
  description: group.description,
  category: group.type,
  is_private: group.isPrivate,
  member_count: group.memberCount,
  role: 'member',
});

const MyGroupsPage = () => {
  const { success, error } = useNotification();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await getMyGroups();
        setGroups(Array.isArray(data) ? data.map(normalizeGroupData) : []);
      } catch {
        error('Failed to load', 'Could not fetch your groups.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [error]);

  const handleLeave = async (groupId: string, groupName: string) => {
    setLeavingId(groupId);
    try {
      await leaveGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      success('Left Group', `You have left "${groupName}".`);
    } catch {
      error('Leave Failed', 'Could not leave the group.');
    } finally {
      setLeavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">My Groups</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and access study groups you are currently a member of.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-surface-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading your groups...
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center text-surface-400 text-sm">
          You haven't joined any groups yet.{' '}
          <Link to="/connect/groups/discover" className="text-primary-500 hover:underline">Discover groups</Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {groups.map((g) => (
            <Card key={g.id} className="p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg text-surface-900 dark:text-white">{g.name}</h3>
                {g.role && (
                  <Badge variant={g.role === 'admin' ? 'primary' : 'default'}>{g.role}</Badge>
                )}
              </div>
              {g.description && (
                <p className="text-xs text-surface-500 mb-2">{g.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-surface-400 mb-4">
                <Badge variant="default">{g.category}</Badge>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {g.member_count || 0} members
                </span>
              </div>
              <div className="flex gap-2">
                <Link to={`/connect/groups/${g.id}`} className="flex-1">
                  <Button variant="outline" className="w-full justify-center" size="sm">
                    View Group
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={leavingId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  onClick={() => handleLeave(g.id, g.name)}
                  disabled={leavingId === g.id}
                >
                  Leave
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyGroupsPage;
