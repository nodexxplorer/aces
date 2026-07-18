import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { getGroups, joinGroup, createGroup } from '../../api/campus-connect';
import { Plus, Loader2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Group } from '../../types';

interface GroupData {
  id: string;
  name: string;
  description?: string;
  category: string;
  avatar_url?: string;
  max_members?: number;
  is_private: boolean;
  created_by: string;
  member_count?: number;
}

const normalizeGroupData = (group: Group): GroupData => ({
  id: group.id,
  name: group.name,
  description: group.description,
  category: group.type,
  avatar_url: undefined,
  max_members: group.maxMembers,
  is_private: group.isPrivate,
  created_by: group.createdBy,
  member_count: group.memberCount,
});

const GroupDiscoveryPage = () => {
  const { success, error } = useNotification();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '', max_members: '', is_private: false });

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await getGroups();
        setGroups(data.map(normalizeGroupData));
      } catch {
        error('Failed to load', 'Could not fetch groups.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [error]);

  const handleJoin = async (groupId: string) => {
    setJoiningId(groupId);
    try {
      await joinGroup(groupId);
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, member_count: (g.member_count || 0) + 1 } : g))
      );
      success('Joined Group', 'You have joined the group.');
    } catch {
      error('Join Failed', 'Could not join the group.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim()) return;
    setCreating(true);
    try {
      const payload: { name: string; description?: string; category: string; max_members?: number; is_private?: boolean } = {
        name: form.name.trim(),
        category: form.category.trim(),
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.max_members) payload.max_members = parseInt(form.max_members);
      if (form.is_private) payload.is_private = true;
      const newGroup = await createGroup(payload);
      setGroups((prev) => [normalizeGroupData(newGroup), ...prev]);
      setShowCreate(false);
      setForm({ name: '', description: '', category: '', max_members: '', is_private: false });
      success('Group Created', `"${newGroup.name}" has been created.`);
    } catch {
      error('Create Failed', 'Could not create the group.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Discover Groups</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Join core academic interest groups or study partner chats.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
          Create Group
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-surface-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading groups...
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center text-surface-400 text-sm">
          No groups available yet. Create the first one!
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {groups.map((g) => (
            <Card key={g.id} className="p-6">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg text-surface-900 dark:text-white">{g.name}</h3>
                {g.is_private ? (
                  <Badge variant="outline">Private</Badge>
                ) : (
                  <Badge variant="info">Public</Badge>
                )}
              </div>
              {g.description && (
                <p className="text-xs text-surface-500 mb-2">{g.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-surface-400 mb-4">
                <Badge variant="default">{g.category}</Badge>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {g.member_count || 0} {g.member_count === 1 ? 'member' : 'members'}
                </span>
              </div>
              <div className="flex gap-2">
                <Link to={`/connect/groups/${g.id}`} className="flex-1">
                  <Button variant="outline" className="w-full justify-center" size="sm">
                    View Group
                  </Button>
                </Link>
                <Button
                  leftIcon={joiningId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  onClick={() => handleJoin(g.id)}
                  disabled={joiningId === g.id}
                  size="sm"
                >
                  Join
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Group" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name *</label>
            <input
              type="text"
              required
              placeholder="Group name"
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Description</label>
            <textarea
              placeholder="What is this group about?"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Category *</label>
              <input
                type="text"
                required
                placeholder="e.g. study, project"
                className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Max Members</label>
              <input
                type="number"
                min="2"
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                value={form.max_members}
                onChange={(e) => setForm((p) => ({ ...p, max_members: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_private"
              className="rounded border-surface-300 text-primary-500 focus:ring-primary-500/20"
              checked={form.is_private}
              onChange={(e) => setForm((p) => ({ ...p, is_private: e.target.checked }))}
            />
            <label htmlFor="is_private" className="text-sm text-surface-700 dark:text-surface-300">Private group</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" isLoading={creating}>Create Group</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GroupDiscoveryPage;
