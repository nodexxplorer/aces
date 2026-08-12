import { useState, useEffect, useMemo } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import DataTable, { type Column } from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { getAllPayments } from '../../api/payments';
import { getErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/formatters';
import { Search, RefreshCw } from 'lucide-react';
import type { Payment, PaymentStatus, PaymentType } from '../../types';

const STATUS_OPTIONS: (PaymentStatus | 'all')[] = ['all', 'pending', 'completed', 'failed', 'refunded'];
const TYPE_OPTIONS: (PaymentType | 'all')[] = [
  'all',
  'dept_dues',
  'class_dues',
  'manual',
  'materials',
  'transcript_fee',
  'other',
];

const TYPE_LABELS: Record<string, string> = {
  dept_dues: 'Department Dues',
  class_dues: 'Class Dues',
  manual: 'Manual/Book Purchase',
  materials: 'Course Materials',
  transcript_fee: 'Transcript Fee',
  other: 'Other',
};

const PaymentHistoryPage = () => {
  const { error: notifyError } = useNotification();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'all'>('all');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await getAllPayments({ limit: 200, offset: 0 });
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      notifyError('Error', getErrorMessage(err, 'Failed to load payment history'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesType = typeFilter === 'all' || p.type === typeFilter;
      const matchesSearch =
        !q ||
        (p.student_name || '').toLowerCase().includes(q) ||
        (p.matric_number || '').toLowerCase().includes(q) ||
        (p.paystack_reference || '').toLowerCase().includes(q) ||
        (p.item_name || '').toLowerCase().includes(q);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [payments, search, statusFilter, typeFilter]);

  // Payment.amount is a Go decimal.Decimal, which serializes as a JSON
  // string (to avoid float rounding on money) — the TS type says `number`
  // but the runtime value is a string, so a raw `sum + p.amount` silently
  // does string concatenation ("0" + "2000" + "3000" -> "020003000")
  // instead of addition, producing an astronomical total once formatted.
  const totalCollected = filtered
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const columns: Column<Payment>[] = [
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (v) => (v ? new Date(v as string).toLocaleDateString() : '—'),
    },
    { key: 'student_name', label: 'Student', sortable: true },
    { key: 'matric_number', label: 'Matric No.' },
    {
      key: 'item_name',
      label: 'Purpose',
      render: (v, row) => (v as string) || row.due_name || TYPE_LABELS[row.type] || row.type,
    },
    { key: 'type', label: 'Type', render: (v) => TYPE_LABELS[v as string] ?? (v as string) },
    { key: 'amount', label: 'Amount', sortable: true, render: (v) => formatCurrency(v as number) },
    { key: 'paystack_reference', label: 'Reference', render: (v) => (v as string) || '—' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Payment History</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Every payment recorded in the system — Paystack and manual, dues and item purchases alike.
          </p>
        </div>
        <button
          onClick={fetchPayments}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-300 dark:border-surface-600 px-3 py-2 text-sm font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
          <p className="text-xs text-surface-500">Showing</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">{filtered.length}</p>
        </div>
        <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
          <p className="text-xs text-surface-500">Completed (in view)</p>
          <p className="text-2xl font-bold text-success-600">
            {filtered.filter((p) => p.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white dark:bg-surface-900 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
          <p className="text-xs text-surface-500">Total Collected (in view)</p>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency(totalCollected)}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>Search, filter, and review the full payment ledger</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search student, matric number, reference, or purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-surface-800 dark:border-surface-700"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
            className="px-3 py-2 text-sm border rounded-lg dark:bg-surface-800 dark:border-surface-700"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PaymentType | 'all')}
            className="px-3 py-2 text-sm border rounded-lg dark:bg-surface-800 dark:border-surface-700"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All Types' : TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={loading}
          emptyTitle="No payments found"
          emptyDescription="Try adjusting your search or filters."
          pageSize={15}
        />
      </Card>
    </div>
  );
};

export default PaymentHistoryPage;
