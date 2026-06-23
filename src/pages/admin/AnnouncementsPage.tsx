import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Plus } from 'lucide-react';

const AnnouncementsPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState([
    { id: '1', title: 'First Semester Exam Commences July 15', date: '2026-06-20' },
  ]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    const newAnn = { id: `${Date.now()}`, title, date: new Date().toISOString().split('T')[0] };
    setList((prev) => [newAnn, ...prev]);
    setOpen(false);
    setTitle('');
    setContent('');
    success('Notice Published', 'Broadcasted announcement to all students.');
  };

  const columns = [
    { key: 'title', label: 'Announcement Title' },
    { key: 'date', label: 'Publish Date' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Announcements Manager</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Broadcast urgent department events and lecture updates.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
          New Notice
        </Button>
      </div>

      <Card>
        <DataTable columns={columns} data={list} />
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Publish Announcement">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Title" placeholder="e.g. Exam Timetable" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Message Content</label>
            <textarea
              placeholder="Notice details..."
              className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Broadcast Notice
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
