import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import { getDefaulters } from '../../api/payments';
import { useNotification } from '../../hooks/useNotification';
import { Download } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Defaulter } from '../../types';

const DefaultersPage = () => {
  const { error: notifyError } = useNotification();
  const [list, setList] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<number | ''>('');

  useEffect(() => {
    fetchDefaulters();
  }, []);

  const fetchDefaulters = async () => {
    try {
      setLoading(true);
      const items = await getDefaulters();
      setList(Array.isArray(items) ? items : []);
    } catch {
      notifyError('Error', 'Failed to load defaulters');
    } finally {
      setLoading(false);
    }
  };

  const filtered = levelFilter !== '' ? list.filter((d) => d.level === levelFilter) : list;

  const handleExport = () => {
    const csv = ['Matric Number,Name,Level,Unpaid Dues,Outstanding (₦)', ...filtered.map(
      (d) => `${d.matric_number},${d.full_name},${d.level * 100},${d.unpaid_dues_count},${d.total_outstanding}`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defaulters_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    { key: 'matric_number', label: 'Matric Number', sortable: true },
    { key: 'full_name', label: 'Student Name', sortable: true },
    { key: 'level', label: 'Level', render: (val: unknown) => `${(val as number) * 100} Level` },
    { key: 'unpaid_dues_count', label: 'Unpaid Dues' },
    { key: 'total_outstanding', label: 'Outstanding', render: (val: unknown) => formatCurrency(val as number) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Dues Defaulters List</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Students with unpaid dues — auto-computed from active dues vs completed payments.
          </p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-800">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Defaulter Registry</CardTitle>
            <CardDescription>{loading ? 'Loading...' : `${filtered.length} student(s)`}</CardDescription>
          </div>
          <select
            className="px-3 py-2 border rounded-lg text-sm dark:bg-surface-800 dark:border-surface-600"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value ? parseInt(e.target.value) : '')}
          >
            <option value="">All Levels</option>
            {[1,2,3,4,5].map((l) => <option key={l} value={l}>{l * 100} Level</option>)}
          </select>
        </CardHeader>
        <DataTable columns={columns} data={filtered as unknown as Record<string, unknown>[]} />
      </Card>
    </div>
  );
};

export default DefaultersPage;
