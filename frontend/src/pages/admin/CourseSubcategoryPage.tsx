import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Plus } from 'lucide-react';

const CourseSubcategoryPage = () => {
  const { success } = useNotification();
  const [subcategories, setSubcategories] = useState([
    { id: '1', name: 'Hardware Engineering' },
    { id: '2', name: 'Software Engineering' },
  ]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const newCat = { id: `${Date.now()}`, name };
    setSubcategories((prev) => [...prev, newCat]);
    setOpen(false);
    setName('');
    success('Subcategory Created', 'New course categorization created.');
  };

  const columns = [
    { key: 'name', label: 'Subcategory Name' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Subcategories</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Categorize courses into software, hardware, communications and power domains.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
          Create Subcategory
        </Button>
      </div>

      <Card>
        <DataTable columns={columns} data={subcategories} />
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create Subcategory">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Subcategory Name" placeholder="e.g. Embedded Hardware" value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit" className="w-full">
            Save Subcategory
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default CourseSubcategoryPage;
