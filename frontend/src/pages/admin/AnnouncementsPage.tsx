import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Megaphone, Send, Loader2, Eye, Trash2 } from 'lucide-react';
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from '../../api/announcements';
import { useAuthStore } from '../../stores/authStore';
import type { Announcement } from '../../types';

const AnnouncementsPage = () => {
  const { success, error: notifyError } = useNotification();
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await getAnnouncements();
      const items = Array.isArray(data) ? data : (data as any).items || [];
      setAnnouncements(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    try {
      setSubmitting(true);
      await createAnnouncement({
        title,
        content,
        target_audience: targetAudience === 'all' ? [] : [targetAudience],
        created_by: user?.id || '',
      });
      setCreateOpen(false);
      setTitle('');
      setContent('');
      success('Announcement Published', 'All users will be notified');
      fetchAnnouncements();
    } catch (err: any) {
      notifyError('Publish Failed', err?.response?.data?.error || 'Could not publish announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      success('Announcement Deleted', 'Removed successfully');
    } catch {
      // silent
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (_: unknown, row: any) => (
        <div>
          <p className="font-semibold">{row.title}</p>
          <p className="text-[10px] text-surface-500 truncate max-w-[200px]">{row.content}</p>
        </div>
      ),
    },
    {
      key: 'target_audience',
      label: 'Audience',
      render: (val: unknown) => {
        if (Array.isArray(val) && val.length > 0) {
          return val.map((a: string) => <StatusBadge key={a} status={a} />);
        }
        return <StatusBadge status="all" />;
      },
    },
    {
      key: 'is_pinned',
      label: 'Pinned',
      render: (val: unknown) => (
        <span className={`text-[10px] px-2 py-1 rounded-full ${val ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-500'}`}>
          {val ? 'Pinned' : 'Normal'}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A',
    },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <div className="flex gap-2">
          <Button size="xs" variant="ghost" leftIcon={<Eye className="w-3.5 h-3.5" />}>
            View
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-danger-500 hover:bg-danger-50"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => handleDelete(row.id)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Announcements</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create, publish and manage system-wide academic announcements.
          </p>
        </div>
        <Button leftIcon={<Megaphone className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Create Announcement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Published Announcements</CardTitle>
          <CardDescription>All active campus-wide announcements</CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading announcements...</span>
          </div>
        ) : (
          <DataTable columns={columns} data={announcements as unknown as Record<string, unknown>[]} />
        )}
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Announcement">
        <form onSubmit={handlePublish} className="space-y-4">
          <Input
            label="Headline"
            placeholder="Enter announcement title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 h-32"
              placeholder="Write your announcement content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Target Audience</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            >
              <option value="all">All Users</option>
              <option value="students">Students Only</option>
              <option value="staff">Staff Only</option>
              <option value="lecturers">Lecturers Only</option>
            </select>
          </div>
          <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Send className="w-4 h-4" />}>
            Publish Announcement
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
