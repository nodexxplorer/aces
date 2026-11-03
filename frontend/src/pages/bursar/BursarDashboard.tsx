import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { formatCurrency } from '../../utils/formatters';
import { getBursarDashboard } from '../../api/lecturers';
import { getAllDues, verifyPayment } from '../../api/payments';
import type { BursarDashboardResponse, PendingPayment } from '../../api/lecturers';
import type { DuePayment } from '../../types';
import {
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  History,
  FileText,
  PenLine,
  Check,
} from 'lucide-react';

export default function BursarDashboard() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [data, setData] = useState<BursarDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'paystack' | 'manual'>('all');
  const [, setDues] = useState<DuePayment[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      await verifyPayment(payment.id);
      success('Verified', `Payment from ${payment.student_name} verified`);
      await fetchDashboard();
    } catch {
      notifyError('Error', 'Failed to verify payment');
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredPending = (data?.pending_payments ?? []).filter((p) => {
    if (activeTab === 'all') return true;
    return p.payment_method === activeTab;
  });

  const stats = data?.stats;

  const kpis = [
    {
      label: 'Total expected',
      value: formatCurrency(stats?.total_revenue ?? 0),
      subtitle: (stats?.total_revenue ?? 0) === 0 ? 'No dues created yet' : `${data?.active_dues ?? 0} dues created`,
      icon: <CreditCard className="w-5 h-5 text-slate-400" />,
      valueColor: 'text-surface-900 dark:text-white',
    },
    {
      label: 'Total collected',
      value: formatCurrency(stats?.total_collected ?? 0),
      subtitle: `${stats?.total_collected ? 1 : 0} payment(s)`,
      icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
      valueColor: 'text-emerald-500',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(stats?.total_outstanding ?? 0),
      subtitle: (stats?.total_outstanding ?? 0) === 0 ? 'Nothing owed' : 'Overdue',
      icon: <AlertTriangle className="w-5 h-5 text-slate-400" />,
      valueColor: 'text-surface-900 dark:text-white',
    },
    {
      label: "Today's collection",
      value: formatCurrency(stats?.today_collection ?? 0),
      subtitle: `${stats?.today_transactions ?? 0} transactions`,
      icon: <Clock className="w-5 h-5 text-slate-400" />,
      valueColor: 'text-surface-900 dark:text-white',
    },
  ];

  const pendingCount = data?.pending_payments?.length ?? 0;
  const paystackCount = (data?.pending_payments ?? []).filter((p) => p.payment_method === 'paystack').length;
  const manualCount = (data?.pending_payments ?? []).filter((p) => p.payment_method === 'manual').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Bursar dashboard</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Monitor fee collections, verify payments and manage financial records.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] hover:bg-surface-50 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between"
          >
            <div className="space-y-1">
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">{kpi.label}</p>
              <p className={`text-2xl font-black ${kpi.valueColor}`}>{loading ? '...' : kpi.value}</p>
              <p className="text-xs text-surface-400 dark:text-slate-500">{kpi.subtitle}</p>
            </div>
            <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">{kpi.icon}</div>
          </div>
        ))}
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Pending verifications & Recent transactions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending verifications card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-surface-900 dark:text-white">Pending verifications</h2>
                <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                  {pendingCount} payments waiting for you
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-100 dark:bg-[#0b101c] rounded-xl border border-surface-200 dark:border-[#1a2538]">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
                  }`}
                >
                  All {pendingCount}
                </button>
                <button
                  onClick={() => setActiveTab('paystack')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'paystack'
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
                  }`}
                >
                  Paystack {paystackCount}
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'manual'
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'text-surface-600 dark:text-slate-400 hover:text-surface-900 dark:hover:text-white'
                  }`}
                >
                  Manual {manualCount}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#1d68ec]" />
              </div>
            ) : filteredPending.length === 0 ? (
              /* Clean empty state exactly matching PDF page 4 */
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-[#152033] flex items-center justify-center text-[#1d68ec] mb-3">
                  <Check className="w-6 h-6 stroke-[2.5]" />
                </div>
                <p className="text-base font-bold text-surface-900 dark:text-white">All clear</p>
                <p className="text-xs text-surface-400 dark:text-slate-400 mt-1">
                  No payments need verification right now.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 dark:text-slate-400 text-left">
                      <th className="py-3 px-3 font-semibold uppercase text-[10px]">Student</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px]">Due</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px] text-right">Amount</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px] text-center">Method</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60">
                    {filteredPending.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-[#152033]/40">
                        <td className="py-3 px-3 font-medium text-surface-900 dark:text-white">
                          {p.student_name}
                          <span className="block text-[11px] text-surface-400 font-mono">{p.matric_number}</span>
                        </td>
                        <td className="py-3 px-3 text-surface-700 dark:text-slate-300">{p.due_name}</td>
                        <td className="py-3 px-3 text-right font-semibold text-surface-900 dark:text-white">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-100 dark:bg-[#1a2538] text-surface-700 dark:text-slate-300">
                            {p.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleVerify(p)}
                            disabled={verifyingId === p.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-medium text-xs hover:bg-emerald-600 cursor-pointer disabled:opacity-50"
                          >
                            {verifyingId === p.id ? '...' : 'Verify'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent transactions card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-surface-900 dark:text-white">Recent transactions</h2>
                <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                  {data?.recent_payments?.length ?? 0} recent payments
                </p>
              </div>
              <Link
                to="/bu/history"
                className="text-xs font-semibold text-[#1d68ec] dark:text-[#4f9bff] hover:underline flex items-center gap-1"
              >
                <span>View full history</span>
                <span>→</span>
              </Link>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#1d68ec]" />
              </div>
            ) : (data?.recent_payments ?? []).length === 0 ? (
              /* Clean empty state exactly matching PDF page 4 */
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-100 dark:bg-[#152033] flex items-center justify-center text-[#1d68ec] mb-3">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-surface-900 dark:text-white">No transactions yet</p>
                <p className="text-xs text-surface-400 dark:text-slate-400 mt-1">
                  Payments from your class will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 dark:text-slate-400 text-left">
                      <th className="py-3 px-3 font-semibold uppercase text-[10px]">Student</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px]">Due</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px] text-right">Amount</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px] text-center">Method</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px] text-center">Status</th>
                      <th className="py-3 px-3 font-semibold uppercase text-[10px] text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60">
                    {data?.recent_payments?.slice(0, 5).map((p) => (
                      <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-[#152033]/40">
                        <td className="py-3 px-3 font-medium text-surface-900 dark:text-white">
                          {p.student_name}
                          <span className="block text-[11px] text-surface-400 font-mono">{p.matric_number}</span>
                        </td>
                        <td className="py-3 px-3 text-surface-700 dark:text-slate-300">{p.due_name}</td>
                        <td className="py-3 px-3 text-right font-semibold text-surface-900 dark:text-white">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-100 dark:bg-[#1a2538] text-surface-700 dark:text-slate-300">
                            {p.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-xs text-surface-400">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick actions & Overview */}
        <div className="space-y-6">
          {/* Quick actions card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
            <h2 className="text-base font-bold text-surface-900 dark:text-white mb-4">Quick actions</h2>

            <div className="space-y-2">
              <Link
                to="/bu/verify"
                className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-[#1d68ec]" />
                  <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                    Verify payments
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-[#1d68ec] transition-colors" />
              </Link>

              <Link
                to="/bu/history"
                className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <History className="w-4 h-4 text-sky-500" />
                  <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                    Payment history
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-sky-500 transition-colors" />
              </Link>

              <Link
                to="/bu/record"
                className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <PenLine className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                    Record manual payment
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-emerald-500 transition-colors" />
              </Link>

              <Link
                to="/bu/defaulters"
                className="flex items-center justify-between p-3.5 rounded-xl border border-surface-200 dark:border-[#1a2538] hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs sm:text-sm font-medium text-surface-800 dark:text-slate-200">
                    See defaulters
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-surface-400 group-hover:text-amber-500 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Overview card */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
            <h2 className="text-base font-bold text-surface-900 dark:text-white mb-4">Overview</h2>

            <div className="divide-y divide-surface-100 dark:divide-surface-800/80 text-xs sm:text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Active dues</span>
                <span className="font-bold text-surface-900 dark:text-white">{data?.active_dues ?? 0}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Pending verifications</span>
                <span className="font-bold text-surface-900 dark:text-white">{pendingCount}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Total students</span>
                <span className="font-bold text-surface-900 dark:text-white">{stats?.total_students ?? 0}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Fully paid</span>
                <span className="font-bold text-surface-900 dark:text-white">{stats?.fully_paid_students ?? 0}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Unpaid students</span>
                <span className="font-bold text-surface-900 dark:text-white">{stats?.unpaid_students ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
