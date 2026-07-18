import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import { formatCurrency } from '../../utils/formatters';
import { getAllDues, createDue, deleteDue } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Plus, Trash2 } from 'lucide-react';
import type { DuePayment } from '../../types';

const ClassBursarDuesPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDues();
  }, []);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const items = await getAllDues();
      const list = Array.isArray(items) ? items : [];
      setDues(list.filter((d) => d.type === 'class_dues'));
    } catch {
      notifyError('Error', 'Failed to load class dues');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount || !user?.id) return;
    try {
      setSaving(true);
      await createDue({
        name: name.trim(),
        description: description || undefined,
        type: 'class_dues',
        amount,
        level: level ? parseInt(level) : undefined,
        created_by: user.id,
      });
      success('Due Created', 'Class due created successfully');
      setName('');
      setAmount('');
      setDescription('');
      setLevel('');
      setShowForm(false);
      fetchDues();
    } catch (err: any) {
      notifyError('Failed', err?.response?.data?.error || 'Could not create due');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (due: DuePayment) => {
    if (!confirm(`Deactivate due "${due.name}"?`)) return;
    try {
      await deleteDue(due.id);
      success('Deactivated', `${due.name} has been deactivated`);
      fetchDues();
    } catch {
      notifyError('Error', 'Could not deactivate due');
    }
  };

  const columns = [
    { key: 'name', label: 'Due Name', sortable: true },
    { key: 'amount', label: 'Amount', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'level', label: 'Level', render: (val: unknown) => val ? `${val} Level` : 'All Levels' },
    { key: 'description', label: 'Description', render: (val: unknown) => (val as string) || '—' },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: DuePayment) => (
        <button className="text-danger-500 hover:text-danger-700" onClick={() => handleDelete(row)}>
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Class Dues</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage class-level dues — create, view, and deactivate.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Due
        </button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Class Due</CardTitle>
          </CardHeader>
          <form onSubmit={handleCreate} className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name</label>
                <input className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. 500 Level Class Dues" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Amount (₦)</label>
                <input className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Level</label>
                <select className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={level} onChange={(e) => setLevel(e.target.value)} required>
                  <option value="">Select level</option>
                  {[1,2,3,4,5].map((l) => <option key={l} value={l}>{l * 100} Level</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Description</label>
                <input className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Due'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-800">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Class Dues Registry</CardTitle>
          <CardDescription>{loading ? 'Loading...' : `${dues.length} due(s) found`}</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={dues as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default ClassBursarDuesPage;
