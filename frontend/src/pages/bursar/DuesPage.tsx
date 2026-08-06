import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import { formatCurrency } from '../../utils/formatters';
import { getAllDues, createDue, deleteDue } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import type { DuePayment } from '../../types';
import { getErrorMessage } from '../../utils/errors';

type Tab = 'class_dues' | 'dept_dues';

const TAB_CONFIG: Record<Tab, { label: string; title: string; description: string; placeholder: string }> = {
  class_dues: {
    label: 'Class Dues',
    title: 'Class Dues',
    description: 'Manage class-level dues — create, view, and deactivate.',
    placeholder: 'e.g. 500 Level Class Dues',
  },
  dept_dues: {
    label: 'Department Dues',
    title: 'Department Dues',
    description: 'Manage department association dues — create, view, and deactivate.',
    placeholder: 'e.g. Department Dues 2025/2026',
  },
};

export default function DuesPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [activeTab, setActiveTab] = useState<Tab>('class_dues');
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
  }, [activeTab]);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const items = await getAllDues();
      const list = Array.isArray(items) ? items : [];
      setDues(list.filter((d) => d.type === activeTab));
    } catch {
      notifyError('Error', `Failed to load ${TAB_CONFIG[activeTab].label.toLowerCase()}`);
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
        type: activeTab,
        amount,
        level: level ? parseInt(level) : undefined,
      });
      success('Due Created', `${TAB_CONFIG[activeTab].title.replace(' Dues', ' due')} created successfully`);
      setName('');
      setAmount('');
      setDescription('');
      setLevel('');
      setShowForm(false);
      fetchDues();
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not create due'));
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

  const cfg = TAB_CONFIG[activeTab];

  const columns = [
    { key: 'name', label: 'Due Name', sortable: true },
    { key: 'amount', label: 'Amount', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'level', label: 'Level', render: (val: unknown) => (val ? `${val} Level` : 'All Levels') },
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
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <DollarSign className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Dues Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Manage class and department dues in one place.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {[
          { key: 'class_dues' as Tab, label: 'Class Dues' },
          { key: 'dept_dues' as Tab, label: 'Department Dues' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key);
              setShowForm(false);
              setName('');
              setAmount('');
              setDescription('');
              setLevel('');
            }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">{cfg.title}</h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">{cfg.description}</p>
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
            <CardTitle>New {cfg.title.replace(' Dues', ' Due')}</CardTitle>
          </CardHeader>
          <form onSubmit={handleCreate} className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={cfg.placeholder}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Amount (₦)
                </label>
                <input
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Level {activeTab === 'dept_dues' ? '(optional)' : ''}
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  required={activeTab === 'class_dues'}
                >
                  <option value="">{activeTab === 'dept_dues' ? 'All Levels' : 'Select level'}</option>
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      {l * 100} Level
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Description
                </label>
                <input
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Due'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{cfg.title} Registry</CardTitle>
          <CardDescription>{loading ? 'Loading...' : `${dues.length} due(s) found`}</CardDescription>
        </CardHeader>
        <DataTable columns={columns} data={dues} />
      </Card>
    </div>
  );
}
