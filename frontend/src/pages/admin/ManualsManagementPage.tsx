import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { BookOpen, Plus, Loader2, Eye, Edit, Trash2 } from 'lucide-react';
import { getManuals, createManual, deleteManual } from '../../api/manuals';
import type { Manual } from '../../api/manuals';
import { getCourses } from '../../api/courses';

const ManualsManagementPage = () => {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('500');
  const [price, setPrice] = useState('0');
  const [courseId, setCourseId] = useState('');
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    fetchManuals();
    fetchCourses();
  }, []);

  const fetchManuals = async () => {
    try {
      setLoading(true);
      const data = await getManuals();
      const items = Array.isArray(data) ? data : (data as any).items || [];
      setManuals(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await getCourses({ page: 1, perPage: 100 });
      const items = Array.isArray(data) ? data : (data as any).items || [];
      setCourses(items);
    } catch {
      // silent
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await createManual({
        title,
        description: description || undefined,
        level: parseInt(level) || 500,
        price: parseFloat(price) || 0,
        course_id: courseId || undefined,
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setLevel('500');
      setPrice('0');
      setCourseId('');
      success('Manual Created', `"${title}" has been added to the resource library`);
      fetchManuals();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not create manual';
      notifyError('Create Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteManual(id);
      setManuals((prev) => prev.filter((m) => m.id !== id));
      success('Manual Deleted', 'Resource removed from library');
    } catch (err: any) {
      notifyError('Delete Failed', err?.response?.data?.error || 'Could not delete manual');
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Manual',
      render: (_: unknown, row: Manual) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <Link to={`/admin/manuals/${row.id}`} className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              {row.title}
            </Link>
            <p className="text-[10px] text-surface-500">{row.description || 'No description'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'level',
      label: 'Level',
      render: (val: unknown) => <StatusBadge status={String(val || 'N/A')} />,
    },
    {
      key: 'price',
      label: 'Price',
      render: (val: unknown) => val ? `₦${Number(val).toLocaleString()}` : 'Free',
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (val: unknown) => <StatusBadge status={val ? 'active' : 'inactive'} />,
    },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: Manual) => (
        <div className="flex gap-2">
          <Button size="xs" variant="ghost" leftIcon={<Eye className="w-3.5 h-3.5" />} onClick={() => navigate(`/admin/manuals/${row.id}`)}>
            View
          </Button>
          <Button size="xs" variant="ghost" leftIcon={<Edit className="w-3.5 h-3.5" />}>
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-danger-500 hover:bg-danger-50"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => handleDelete(row.id, row.title)}
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
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Manuals & Resources</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create, update and manage departmental handbooks, guides and academic resources.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Create Manual
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource Library</CardTitle>
          <CardDescription>
            {manuals.length} manual{manuals.length !== 1 && 's'} and resource{manuals.length !== 1 && 's'} available
          </CardDescription>
        </CardHeader>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading manuals...</span>
          </div>
        ) : (
          <DataTable columns={columns as any} data={manuals as any} />
        )}
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New Manual">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Title" placeholder="e.g. CPE 523 Lab Manual" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 h-24"
              placeholder="Brief description of this resource..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Level" type="number" value={level} onChange={(e) => setLevel(e.target.value)} required />
            <Input label="Price (NGN)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Select Course</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">No specific course</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full" isLoading={submitting}>
            Create Manual
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default ManualsManagementPage;
