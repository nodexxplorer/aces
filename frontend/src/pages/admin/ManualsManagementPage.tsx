import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Plus } from 'lucide-react';

const ManualsManagementPage = () => {
  const { success } = useNotification();
  const [list, setList] = useState([
    { id: '1', name: 'CPE 511 Laboratory Manual', course: 'CPE 511', price: 1500 },
  ]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [price, setPrice] = useState('1500');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !course) return;
    const newManual = { id: `${Date.now()}`, name, course, price: parseInt(price) };
    setList((prev) => [...prev, newManual]);
    setOpen(false);
    setName('');
    setCourse('');
    success('Manual Added', 'New course manual uploaded.');
  };

  const columns = [
    { key: 'name', label: 'Manual Title' },
    { key: 'course', label: 'Course Code' },
    { key: 'price', label: 'Cost Price', render: (val: unknown) => `₦${(val as number).toLocaleString()}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Manuals Inventory</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Publish and manage core course manuals and lab worksheet price lists.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
          Add Manual
        </Button>
      </div>

      <Card>
        <DataTable columns={columns} data={list} />
      </Card>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Upload Course Manual">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Manual Title" placeholder="e.g. CPE 511 Lab Workbook" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Course Code" placeholder="e.g. CPE 511" value={course} onChange={(e) => setCourse(e.target.value)} required />
          <Input label="Price (₦)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Button type="submit" className="w-full">
            Publish Manual
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default ManualsManagementPage;
