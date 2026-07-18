import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { getBursarDashboard, recordManualPayment } from '../../api/lecturers';
import { getAllDues, verifyPayment } from '../../api/payments';
import type { BursarDashboardResponse, PendingPayment } from '../../api/lecturers';
import type { DuePayment } from '../../types';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  ExternalLink,
  PenLine,
  ArrowUpRight,
} from 'lucide-react';

const BursarDashboard = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [data, setData] = useState<BursarDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'paystack' | 'manual'>('all');
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [recording, setRecording] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formStudentId, setFormStudentId] = useState('');
  const [formDueId, setFormDueId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formBankRef, setFormBankRef] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const fetchDashboard = async () => {
    try {
      const res = await getBursarDashboard();
      setData(res);
    } catch {
      notifyError('Error', 'Failed to load dashboard data');
    }
  };

  const fetchDues = async () => {
    try {
      const res = await getAllDues();
      const arr = Array.isArray(res) ? res : [];
      setDues(arr.filter((d) => d.is_active));
    } catch {
      setDues([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDashboard(), fetchDues()]).finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const handleVerify = async (payment: PendingPayment) => {
    if (!user?.id) return;
    setVerifyingId(payment.id);
    try {
      await verifyPayment(payment.id, user.id);
      success('Verified', `Payment from ${payment.student_name} verified`);
      await fetchDashboard();
    } catch {
      notifyError('Error', 'Failed to verify payment');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!formStudentId.trim() || !formDueId || !formAmount) return;
    setRecording(true);
    try {
      await recordManualPayment({
        student_id: formStudentId.trim(),
        due_id: formDueId,
        amount: formAmount,
        bank_name: formBankName || undefined,
        bank_reference: formBankRef || undefined,
        notes: formNotes || undefined,
      });
      success('Recorded', 'Manual payment recorded successfully');
      setRecordModalOpen(false);
      resetForm();
      await fetchDashboard();
    } catch {
      notifyError('Error', 'Failed to record payment');
    } finally {
      setRecording(false);
    }
  };

  const resetForm = () => {
    setFormStudentId('');
    setFormDueId('');
    setFormAmount('');
    setFormBankName('');
    setFormBankRef('');
    setFormNotes('');
  };

  const filteredPending = (data?.pending_payments ?? []).filter((p) => {
    if (activeTab === 'all') return true;
    return p.payment_method === activeTab;
  });

  const methodBadge = (method: string) => {
    if (method === 'paystack') return <Badge variant="info">{method}</Badge>;
    return <Badge variant="secondary">{method}</Badge>;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" dot>{status}</Badge>;
      case 'pending':
        return <Badge variant="warning" dot>{status}</Badge>;
      case 'failed':
        return <Badge variant="danger" dot>{status}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const stats = data?.stats;

  const kpis = [
    {
      label: 'Total Revenue',
      value: formatCurrency(stats?.total_revenue ?? 0),
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-primary-500',
      bg: 'bg-primary-500/10 dark:bg-primary-500/20',
    },
    {
      label: 'Total Collected',
      value: formatCurrency(stats?.total_collected ?? 0),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-success-500',
      bg: 'bg-success-500/10 dark:bg-success-500/20',
    },
    {
      label: 'Outstanding Balance',
      value: formatCurrency(stats?.total_outstanding ?? 0),
      icon: <AlertTriangle className="w-5 h-5" />,
      color:
        (stats?.total_outstanding ?? 0) > 500000
          ? 'text-danger-500'
          : (stats?.total_outstanding ?? 0) > 100000
          ? 'text-warning-500'
          : 'text-success-500',
      bg:
        (stats?.total_outstanding ?? 0) > 500000
          ? 'bg-danger-500/10 dark:bg-danger-500/20'
          : (stats?.total_outstanding ?? 0) > 100000
          ? 'bg-warning-500/10 dark:bg-warning-500/20'
          : 'bg-success-500/10 dark:bg-success-500/20',
    },
    {
      label: "Today's Collection",
      value: `${formatCurrency(stats?.today_collection ?? 0)}`,
      subtitle: `${stats?.today_transactions ?? 0} transaction(s)`,
      icon: <Clock className="w-5 h-5" />,
      color: 'text-accent-500',
      bg: 'bg-accent-500/10 dark:bg-accent-500/20',
    },
  ];

  const tabs = [
    { key: 'all' as const, label: 'All', count: data?.pending_payments?.length ?? 0 },
    { key: 'paystack' as const, label: 'Paystack', count: (data?.pending_payments ?? []).filter((p) => p.payment_method === 'paystack').length },
    { key: 'manual' as const, label: 'Manual', count: (data?.pending_payments ?? []).filter((p) => p.payment_method === 'manual').length },
  ];

  const selectedDue = dues.find((d) => d.id === formDueId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Bursar Dashboard</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Monitor fee collections, verify payments, and manage financial records.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          leftIcon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} padding="md">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-surface-500 dark:text-surface-400">{kpi.label}</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white">{loading ? '--' : kpi.value}</p>
                {kpi.subtitle && (
                  <p className="text-xs text-surface-400 dark:text-surface-500">{kpi.subtitle}</p>
                )}
              </div>
              <div className={`p-2.5 rounded-lg ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
                <div>
                  <CardTitle>Pending Verifications</CardTitle>
                  <CardDescription>{filteredPending.length} payment(s) awaiting verification</CardDescription>
                </div>
                <div className="flex gap-1 bg-surface-100 dark:bg-surface-700/50 rounded-lg p-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activeTab === tab.key
                          ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                          : 'text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200'
                      }`}
                    >
                      {tab.label}
                      <span className="ml-1.5 text-surface-400 dark:text-surface-500">{tab.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="w-10 h-10 text-success-400 mb-2" />
                <p className="text-sm font-medium text-surface-600 dark:text-surface-300">All clear</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">No pending verifications</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Student</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Matric No.</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Due</th>
                      <th className="text-right py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Amount</th>
                      <th className="text-center py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Method</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Date</th>
                      <th className="text-center py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                    {filteredPending.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                        <td className="py-3 px-4 text-surface-900 dark:text-surface-100 font-medium">{p.student_name}</td>
                        <td className="py-3 px-4 text-surface-500 dark:text-surface-400 font-mono text-xs">{p.matric_number}</td>
                        <td className="py-3 px-4 text-surface-700 dark:text-surface-300">{p.due_name}</td>
                        <td className="py-3 px-4 text-right text-surface-900 dark:text-surface-100 font-medium">{formatCurrency(p.amount)}</td>
                        <td className="py-3 px-4 text-center">{methodBadge(p.payment_method)}</td>
                        <td className="py-3 px-4 text-surface-500 dark:text-surface-400 text-xs">
                          {p.created_at ? formatDateTime(p.created_at) : '--'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="xs"
                            variant="success"
                            disabled={verifyingId === p.id}
                            onClick={() => handleVerify(p)}
                            leftIcon={verifyingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          >
                            {verifyingId === p.id ? 'Verifying...' : 'Verify'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>{data?.recent_payments?.length ?? 0} recent payment(s)</CardDescription>
            </CardHeader>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
              </div>
            ) : (data?.recent_payments ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CreditCard className="w-10 h-10 text-surface-300 dark:text-surface-600 mb-2" />
                <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No transactions yet</p>
                <p className="text-xs text-surface-400 dark:text-surface-500">Transactions will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Student</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Due</th>
                      <th className="text-right py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Amount</th>
                      <th className="text-center py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Method</th>
                      <th className="text-center py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-surface-500 dark:text-surface-400">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                    {data?.recent_payments?.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors">
                        <td className="py-3 px-4 text-surface-900 dark:text-surface-100 font-medium">{p.student_name}</td>
                        <td className="py-3 px-4 text-surface-700 dark:text-surface-300">{p.due_name}</td>
                        <td className="py-3 px-4 text-right text-surface-900 dark:text-surface-100 font-medium">{formatCurrency(p.amount)}</td>
                        <td className="py-3 px-4 text-center">{methodBadge(p.payment_method)}</td>
                        <td className="py-3 px-4 text-center">{statusBadge(p.status)}</td>
                        <td className="py-3 px-4 text-surface-500 dark:text-surface-400 text-xs">
                          {p.created_at ? formatDateTime(p.created_at) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <a
                href="/bursar/verify-payments"
                className="flex items-center justify-between p-3 rounded-lg border border-surface-200 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary-500/10 dark:bg-primary-500/20 text-primary-500">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Verify Payments</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-primary-500 transition-colors" />
              </a>

              <button
                onClick={() => setRecordModalOpen(true)}
                className="flex items-center justify-between w-full p-3 rounded-lg border border-surface-200 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/30 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success-500/10 dark:bg-success-500/20 text-success-500">
                    <PenLine className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Record Manual Payment</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-success-500 transition-colors" />
              </button>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500 dark:text-surface-400">Active Dues</span>
                <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">{data?.active_dues ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500 dark:text-surface-400">Pending Verifications</span>
                <span className="text-sm font-semibold text-warning-500">{data?.pending_payments?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500 dark:text-surface-400">Total Students</span>
                <span className="text-sm font-semibold text-surface-900 dark:text-surface-100">{stats?.total_students ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500 dark:text-surface-400">Fully Paid</span>
                <span className="text-sm font-semibold text-success-500">{stats?.fully_paid_students ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500 dark:text-surface-400">Unpaid Students</span>
                <span className="text-sm font-semibold text-danger-500">{stats?.unpaid_students ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={recordModalOpen}
        onClose={() => { setRecordModalOpen(false); resetForm(); }}
        title="Record Manual Payment"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Student ID
            </label>
            <input
              type="text"
              value={formStudentId}
              onChange={(e) => setFormStudentId(e.target.value)}
              placeholder="Enter student UUID"
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Due
            </label>
            <select
              value={formDueId}
              onChange={(e) => {
                setFormDueId(e.target.value);
                const due = dues.find((d) => d.id === e.target.value);
                if (due) setFormAmount(String(due.amount));
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a due</option>
              {dues.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {formatCurrency(d.amount)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder={selectedDue ? String(selectedDue.amount) : '0'}
              min="0"
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                value={formBankName}
                onChange={(e) => setFormBankName(e.target.value)}
                placeholder="e.g. GTBank"
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Bank Reference
              </label>
              <input
                type="text"
                value={formBankRef}
                onChange={(e) => setFormBankRef(e.target.value)}
                placeholder="Transaction reference"
                className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Notes
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setRecordModalOpen(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              isLoading={recording}
              disabled={!formStudentId.trim() || !formDueId || !formAmount}
              onClick={handleRecordPayment}
            >
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BursarDashboard;
