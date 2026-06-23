import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Plus, Trash2 } from 'lucide-react';

const mockCourses = [
  { id: '1', code: 'CPE 511', title: 'Embedded Systems Design', units: 3 },
  { id: '2', code: 'CPE 513', title: 'Computer Architecture II', units: 3 },
];

const CourseManagementPage = () => {
  const { success } = useNotification();
  const [courses, setCourses] = useState(mockCourses);
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState('3');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !title) return;
    const newCourse = {
      id: `${Date.now()}`,
      code,
      title,
      units: parseInt(units),
    };
    setCourses((prev) => [newCourse, ...prev]);
    setCreateOpen(false);
    setCode('');
    setTitle('');
    success('Course Created', `Successfully registered academic course ${code}`);
  };

  const handleDelete = (id: string, code: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    success('Course Removed', `Successfully archived academic course ${code}`);
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'units', label: 'Credit Units' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: any) => (
        <Button size="xs" variant="outline" className="text-danger-500 hover:bg-danger-50" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(row.id, row.code)}>
          Archive
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create, modify and archive academic course models.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Create Course
        </Button>
      </div>

      <Card>
        <DataTable columns={columns} data={courses} />
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New Course">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Course Code" placeholder="e.g. CPE 511" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Input label="Course Title" placeholder="e.g. Embedded Systems Design" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input label="Credit Units" type="number" value={units} onChange={(e) => setUnits(e.target.value)} required />
          <Button type="submit" className="w-full">
            Save Course
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default CourseManagementPage;
