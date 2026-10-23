import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getAllPayments, getAllDues, downloadPaymentReceipt, verifyPayment } from '../../api/payments';
import { getStudents } from '../../api/users';
import { getSessions } from '../../api/sessions';
import type { Payment, DuePayment, User, Session } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { departmentAdminPath } from '../../config/departmentAdminPaths';
import { DuesNavHeader } from '../../components/finance/DuesNavHeader';
import {
  CreditCard,
  Download,
  Search,
  Check,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  RefreshCw,
  Plus,
  Send,
  MoreVertical,
} from 'lucide-react';

const formatNaira = (v: number | string) => {
  return `₦${Number(v || 0).toLocaleString()}`;
};

/** Derive payment method from the Paystack reference prefix. */
const getPaymentMethod = (p: Payment): string => {
  const ref = (p.paystack_reference || '').toUpperCase();
  if (ref.startsWith('OPY')) return 'OPay';
  return 'Paystack';
};

export default function PaymentHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const urlCode = user?.tenant?.urlCode;
  const { success, error: notifyError } = useNotification();

  const [, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'successful' | 'pending' | 'failed'>('all');
  const [dueFilter, setDueFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [amountFilter, setAmountFilter] = useState<string>('all');

  // Selected payment for right column details panel
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, duesRes, studentsRes, sessionsRes] = await Promise.allSettled([
        getAllPayments({ limit: 500 }),
        getAllDues({ limit: 100 }),
        getStudents({ perPage: 100 }),
        getSessions(),
      ]);

      let loadedPayments: Payment[] = [];
      if (paymentsRes.status === 'fulfilled') {
        loadedPayments = Array.isArray(paymentsRes.value) ? paymentsRes.value : [];
        setPayments(loadedPayments);
      }
      if (duesRes.status === 'fulfilled') {
        setDues(Array.isArray(duesRes.value) ? duesRes.value : []);
      }
      if (studentsRes.status === 'fulfilled') {
        setStudents(Array.isArray(studentsRes.value) ? studentsRes.value : []);
      }
      if (sessionsRes.status === 'fulfilled') {
        setSessions(Array.isArray(sessionsRes.value) ? sessionsRes.value : []);
      }

      if (loadedPayments.length > 0 && !selectedPayment) {
        setSelectedPayment(loadedPayments[0]);
      }
    } catch {
      notifyError('Error', 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update selected payment if payments change
  useEffect(() => {
    if (payments.length > 0 && (!selectedPayment || !payments.some((p) => p.id === selectedPayment.id))) {
      setSelectedPayment(payments[0]);
    }
  }, [payments, selectedPayment]);

  // Real stats
  const totalCollected = useMemo(() => {
    return payments
      .filter((p) => p.status === 'completed' || p.status === 'success' || p.status === 'verified')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [payments]);

  const successfulCount = useMemo(() => {
    return payments.filter((p) => p.status === 'completed' || p.status === 'success' || p.status === 'verified').length;
  }, [payments]);

  const pendingCount = useMemo(() => {
    return payments.filter((p) => p.status === 'pending').length;
  }, [payments]);

  const failedCount = useMemo(() => {
    return payments.filter((p) => p.status === 'failed').length;
  }, [payments]);

  // Filter payments
  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();

    return payments.filter((p) => {
      // Status filter
      if (statusTab === 'successful') {
        if (p.status !== 'completed' && p.status !== 'success' && p.status !== 'verified') return false;
      } else if (statusTab === 'pending') {
        if (p.status !== 'pending') return false;
      } else if (statusTab === 'failed') {
        if (p.status !== 'failed') return false;
      }

      // Due filter
      if (dueFilter !== 'all') {
        if (p.due_id !== dueFilter && p.due_name !== dueFilter && p.type !== dueFilter) return false;
      }

      // Student level filter
      const student = students.find((s) => s.id === p.student_id);
      if (levelFilter !== 'all') {
        const studentLevel = student?.level;
        if (studentLevel === undefined || String(studentLevel) !== levelFilter) return false;
      }

      // Payment method filter
      if (methodFilter !== 'all') {
        const method = getPaymentMethod(p).toLowerCase();
        if (!method.includes(methodFilter.toLowerCase())) return false;
      }

      // Date range filter
      if (dateFilter !== 'all') {
        const pDate = new Date(p.created_at || p.createdAt || p.paid_at || '');
        if (!isNaN(pDate.getTime())) {
          const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);
          if (dateFilter === '7d' && diffDays > 7) return false;
          if (dateFilter === '30d' && diffDays > 30) return false;
          if (dateFilter === 'semester' && diffDays > 120) return false;
        }
      }

      // Amount filter
      const amt = Number(p.amount) || 0;
      if (amountFilter === 'under3k' && amt >= 3000) return false;
      if (amountFilter === '3k-10k' && (amt < 3000 || amt > 10000)) return false;
      if (amountFilter === 'over10k' && amt <= 10000) return false;

      // Text search
      if (q) {
        const matchName = (p.student_name || student?.fullName || '').toLowerCase().includes(q);
        const matchMatric = (p.matric_number || student?.matricNumber || '').toLowerCase().includes(q);
        const matchRef = (p.paystack_reference || p.id).toLowerCase().includes(q);
        const matchDue = (p.due_name || '').toLowerCase().includes(q);
        if (!matchName && !matchMatric && !matchRef && !matchDue) return false;
      }

      return true;
    });
  }, [payments, students, searchQuery, statusTab, dueFilter, levelFilter, methodFilter, dateFilter, amountFilter]);

  // Paginated list
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, page, pageSize]);

  // Download official receipt
  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      setDownloadingId(paymentId);
      await downloadPaymentReceipt(paymentId);
      success('Receipt Downloaded', 'Official receipt PDF has been saved.');
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not download receipt.'));
    } finally {
      setDownloadingId(null);
    }
  };

  // Re-verify payment with gateway
  const handleVerifyGateway = async (paymentId: string) => {
    try {
      setVerifyingId(paymentId);
      await verifyPayment(paymentId);
      success('Verified', 'Payment status updated from gateway.');
      fetchData();
    } catch (err: unknown) {
      notifyError('Verification Failed', getErrorMessage(err, 'Could not verify payment.'));
    } finally {
      setVerifyingId(null);
    }
  };

  // Resend receipt notification to student
  const handleResendToStudent = (payment: Payment) => {
    success(
      'Receipt Resent',
      `Payment confirmation sent to student for reference ${payment.paystack_reference || payment.id.slice(0, 8)}.`,
    );
  };

  // Export full CSV
  const handleExportCSV = () => {
    if (payments.length === 0) {
      notifyError('Export', 'No transaction records to export.');
      return;
    }

    const headers = 'Reference,Student Name,Matric Number,Level,Due Name,Amount (₦),Method,Status,Date';
    const rows = filteredPayments.map((p) => {
      const student = students.find((s) => s.id === p.student_id);
      const studentName = p.student_name || student?.fullName || 'Student';
      const matric = p.matric_number || student?.matricNumber || '—';
      const lvl = student?.level ? `${student.level}L` : '—';
      const due = p.due_name || p.type || 'Department Dues';
      const amt = p.amount || 0;
      const method = getPaymentMethod(p);
      const status = p.status || 'completed';
      const date = p.created_at || p.createdAt || p.paid_at || '';
      return `"${p.paystack_reference || p.id}","${studentName}","${matric}","${lvl}","${due}",${amt},"${method}","${status}","${date}"`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Exported', `${filteredPayments.length} transactions exported to CSV.`);
  };

  // Active filters helper count
  const hasActiveFilters =
    levelFilter !== 'all' ||
    dueFilter !== 'all' ||
    methodFilter !== 'all' ||
    dateFilter !== 'all' ||
    amountFilter !== 'all' ||
    statusTab !== 'all' ||
    searchQuery.trim().length > 0;

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusTab('all');
    setDueFilter('all');
    setLevelFilter('all');
    setMethodFilter('all');
    setDateFilter('all');
    setAmountFilter('all');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        {/* ─── HEADER & SUB-NAVIGATION ─── */}
        <DuesNavHeader
          activeTab="transactions"
          title="Transactions"
          subtitle="Every payment made by students, with filters and receipts."
          rightAction={
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200 shadow-xs transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          }
        />

        {/* ─── 4 TOP STAT TILES ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Collected */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Collected</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {formatNaira(totalCollected)}
            </p>
          </div>

          {/* Successful */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Successful</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {successfulCount}
            </p>
          </div>

          {/* Pending */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {pendingCount}
            </p>
          </div>

          {/* Failed */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Failed</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
              {failedCount}
            </p>
          </div>
        </div>

        {/* ─── SEARCH & FILTER ROW ─── */}
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, matric number or reference"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 shadow-xs self-start lg:self-auto">
              {(['all', 'successful', 'pending', 'failed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setStatusTab(tab);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    statusTab === tab
                      ? 'bg-[#1a66d6] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* All dues dropdown */}
            <select
              value={dueFilter}
              onChange={(e) => {
                setDueFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All dues</option>
              {dues.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* All levels dropdown */}
            <select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All levels</option>
              <option value="100">100 Level</option>
              <option value="200">200 Level</option>
              <option value="300">300 Level</option>
              <option value="400">400 Level</option>
              <option value="500">500 Level</option>
            </select>

            {/* All methods dropdown */}
            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All methods</option>
              <option value="paystack">Paystack</option>
              <option value="opay">OPay</option>
              <option value="manual">Manual / Bank</option>
            </select>

            {/* Date range dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="semester">This semester</option>
            </select>

            {/* Amount range dropdown */}
            <select
              value={amountFilter}
              onChange={(e) => {
                setAmountFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">Amount range</option>
              <option value="under3k">Under ₦3,000</option>
              <option value="3k-10k">₦3,000 – ₦10,000</option>
              <option value="over10k">Over ₦10,000</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs font-semibold text-[#1a66d6] hover:underline ml-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ─── WHEN 0 TRANSACTIONS EXIST (EMPTY STATE MATCHING SCREENSHOT 1) ─── */}
        {payments.length === 0 ? (
          <div className="space-y-6">
            {/* Center Empty State Box */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-12 sm:p-16 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center mb-4">
                <FileText className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">No transactions yet</h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-5">
                When students pay dues through Paystack or OPay, every payment shows up here. You can filter by student,
                due, level and status.
              </p>
              <button
                type="button"
                onClick={() => navigate(departmentAdminPath(urlCode, '/bursar/dues'))}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-blue-600 text-white shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create a due</span>
              </button>
            </div>

            {/* Bottom Card: What you will see here */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">What you will see here</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">Who paid</h5>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">Name, matric number and level.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">What they paid for</h5>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">Due, amount, method and reference.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">Payment status</h5>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      Successful, pending or failed, with a gateway check.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ─── WHEN TRANSACTIONS EXIST (POPULATED MATCHING SCREENSHOT 2) ─── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Transactions Table & Pagination */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3.5 px-5">Student</th>
                        <th className="py-3.5 px-4">Due and Reference</th>
                        <th className="py-3.5 px-4">Amount</th>
                        <th className="py-3.5 px-4">Method</th>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {paginatedPayments.length > 0 ? (
                        paginatedPayments.map((p) => {
                          const student = students.find((s) => s.id === p.student_id);
                          const studentName = p.student_name || student?.fullName || 'Student';
                          const matric = p.matric_number || student?.matricNumber || '—';
                          const lvl = student?.level ? `${student.level}L` : '';
                          const isSelected = selectedPayment?.id === p.id;

                          // Initials
                          const initials =
                            studentName
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join('') || 'ST';

                          const isSuccessful =
                            p.status === 'completed' || p.status === 'success' || p.status === 'verified';
                          const isPending = p.status === 'pending';

                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedPayment(p)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-50/70 dark:bg-blue-950/30'
                                  : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                              }`}
                            >
                              {/* Student Avatar, Name, Matric */}
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#1a66d6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                    {initials}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white truncate">{studentName}</p>
                                    <p className="text-[11px] text-slate-400 truncate">
                                      {matric} {lvl ? `· ${lvl}` : ''}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Due & Reference */}
                              <td className="py-3.5 px-4">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                                  {p.due_name || p.type || 'Department dues'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                                  {p.paystack_reference || p.id.slice(0, 10)}
                                </p>
                              </td>

                              {/* Amount */}
                              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                                {formatNaira(p.amount)}
                              </td>

                              {/* Method */}
                              <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 capitalize">
                                {getPaymentMethod(p)}
                              </td>

                              {/* Date */}
                              <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                                {p.created_at || p.createdAt || p.paid_at
                                  ? new Date(p.created_at || p.createdAt || p.paid_at || '').toLocaleDateString(
                                      'en-GB',
                                      { day: 'numeric', month: 'short', year: 'numeric' },
                                    )
                                  : '—'}
                              </td>

                              {/* Status Badge */}
                              <td className="py-3.5 px-4">
                                {isSuccessful ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    Successful
                                  </span>
                                ) : isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                    <Clock className="w-3 h-3" />
                                    Pending
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                    <AlertTriangle className="w-3 h-3" />
                                    Failed
                                  </span>
                                )}
                              </td>

                              {/* Row Action menu */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenRowMenuId(openRowMenuId === p.id ? null : p.id);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  {openRowMenuId === p.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30"
                                    >
                                      {isSuccessful && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenRowMenuId(null);
                                            handleDownloadReceipt(p.id);
                                          }}
                                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                          <span>Download receipt</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        disabled={verifyingId === p.id}
                                        onClick={() => {
                                          setOpenRowMenuId(null);
                                          handleVerifyGateway(p.id);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>Check with gateway</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No transactions match your search and filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <span className="text-slate-500">
                    Showing {Math.min(filteredPayments.length, (page - 1) * pageSize + 1)}–
                    {Math.min(filteredPayments.length, page * pageSize)} of {filteredPayments.length}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 text-slate-600 dark:text-slate-300"
                    >
                      ‹
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .slice(0, 5)
                      .map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setPage(num)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold ${
                            page === num
                              ? 'bg-[#1a66d6] text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 text-slate-600 dark:text-slate-300"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Sticky Payment Details Panel (Screenshot 2) */}
            <div className="lg:col-span-1">
              {selectedPayment ? (
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-6 shadow-sm space-y-5 sticky top-6">
                  {/* Title & Status */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Payment details</h3>
                    {selectedPayment.status === 'completed' ||
                    selectedPayment.status === 'success' ||
                    selectedPayment.status === 'verified' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Successful
                      </span>
                    ) : selectedPayment.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                        <AlertTriangle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </div>

                  {/* Big Amount Paid */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount paid</span>
                    <p className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">
                      {formatNaira(selectedPayment.amount)}
                    </p>
                  </div>

                  {/* Student Identity Card */}
                  {(() => {
                    const student = students.find((s) => s.id === selectedPayment.student_id);
                    const name = selectedPayment.student_name || student?.fullName || 'Student';
                    const matric = selectedPayment.matric_number || student?.matricNumber || '—';
                    const lvl = student?.level ? `${student.level} Level` : '';
                    const initials =
                      name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join('') || 'ST';

                    return (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <div className="w-10 h-10 rounded-full bg-[#1a66d6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {matric} {lvl ? `· ${lvl}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Attributes List */}
                  <div className="space-y-3 text-xs pt-1">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Reference</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                        {selectedPayment.paystack_reference || selectedPayment.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Due</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
                        {selectedPayment.due_name || selectedPayment.type || 'Departmental dues'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Method</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {getPaymentMethod(selectedPayment)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Date</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedPayment.created_at || selectedPayment.createdAt || selectedPayment.paid_at
                          ? new Date(
                              selectedPayment.created_at || selectedPayment.createdAt || selectedPayment.paid_at || '',
                            ).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">Session</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {sessions.find((s) => s.is_active)?.name || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2.5 pt-2">
                    <button
                      type="button"
                      disabled={downloadingId === selectedPayment.id}
                      onClick={() => handleDownloadReceipt(selectedPayment.id)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#1a66d6] hover:bg-blue-600 text-white shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>{downloadingId === selectedPayment.id ? 'Downloading...' : 'Download receipt'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleResendToStudent(selectedPayment)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      <span>Resend to student</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    Pending payments can be checked with the gateway from the row menu.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-8 text-center text-slate-400 text-xs">
                  Select a transaction to inspect details and download receipt.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
