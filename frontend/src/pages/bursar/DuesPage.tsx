import { useState, useEffect, useMemo } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { getAllDues, createDue, deleteDue, getAllPayments } from '../../api/payments';
import { getStudents } from '../../api/users';
import type { DuePayment, Payment, User } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import { CreditCard, BarChart3, Plus, Check, X, Folder } from 'lucide-react';

export default function DuesPage() {
  const { success, error: notifyError } = useNotification();

  const [dues, setDues] = useState<DuePayment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formLevel, setFormLevel] = useState<number | 'all'>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [duesRes, paymentsRes, studentsRes] = await Promise.allSettled([
        getAllDues({ limit: 100 }),
        getAllPayments({ limit: 500 }),
        getStudents({ perPage: 150 }),
      ]);

      if (duesRes.status === 'fulfilled') {
        setDues(Array.isArray(duesRes.value) ? duesRes.value : []);
      }
      if (paymentsRes.status === 'fulfilled') {
        setPayments(Array.isArray(paymentsRes.value) ? paymentsRes.value : []);
      }
      if (studentsRes.status === 'fulfilled') {
        setStudents(Array.isArray(studentsRes.value) ? studentsRes.value : []);
      }
    } catch {
      notifyError('Error', 'Failed to load dues data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const completedPayments = useMemo(() => {
    return payments.filter((p) => p.status === 'completed' || p.status === 'success' || p.status === 'verified');
  }, [payments]);

  // Real stats
  const activeDues = dues.filter((d) => d.is_active);
  const activeDuesCount = activeDues.length;

  const totalExpected = useMemo(() => {
    if (activeDues.length === 0) return 0;
    return activeDues.reduce((acc, d) => {
      const studentCount = d.level ? students.filter((s) => s.level === d.level).length : Math.max(students.length, 1);
      return acc + (Number(d.amount) || 0) * (studentCount || 1);
    }, 0);
  }, [activeDues, students]);

  const totalCollected = useMemo(() => {
    return completedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [completedPayments]);

  const collectionRate = useMemo(() => {
    if (totalExpected <= 0 || totalCollected <= 0) return 0;
    return Math.min(100, Math.round((totalCollected / totalExpected) * 100));
  }, [totalCollected, totalExpected]);

  const handleDeactivate = async (due: DuePayment) => {
    if (!confirm(`Are you sure you want to deactivate "${due.name}"?`)) return;
    try {
      await deleteDue(due.id);
      success('Deactivated', `"${due.name}" has been deactivated.`);
      await fetchData();
    } catch {
      notifyError('Error', 'Failed to deactivate due');
    }
  };

  const handleCreateDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAmount) return;

    try {
      setSubmitting(true);
      await createDue({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        type: 'class_dues',
        amount: formAmount,
        level: formLevel === 'all' ? undefined : Number(formLevel),
        deadline: formDeadline ? new Date(formDeadline).toISOString() : undefined,
      });

      success('Due Created', `"${formName}" created successfully.`);
      setModalOpen(false);
      setFormName('');
      setFormDescription('');
      setFormAmount('');
      setFormDeadline('');
      setFormLevel('all');
      await fetchData();
    } catch (err) {
      notifyError('Failed', getErrorMessage(err, 'Failed to create due'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-surface-400 dark:text-slate-400 uppercase tracking-wider mb-1">
            Dues &amp; Payments
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Class dues</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage dues for your class in one place.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create due</span>
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Active dues</p>
            <p className="text-2xl font-black text-surface-900 dark:text-white">{loading ? '...' : activeDuesCount}</p>
          </div>
          <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
            <Folder className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Expected</p>
            <p className="text-2xl font-black text-surface-900 dark:text-white">
              {loading ? '...' : formatCurrency(totalExpected)}
            </p>
          </div>
          <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
            <CreditCard className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Collected</p>
            <p className="text-2xl font-black text-emerald-500">{loading ? '...' : formatCurrency(totalCollected)}</p>
          </div>
          <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
            <Check className="w-5 h-5 text-emerald-500 stroke-[3]" />
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Collection rate</p>
            <p className="text-2xl font-black text-surface-900 dark:text-white">
              {loading ? '...' : `${collectionRate}%`}
            </p>
          </div>
          <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-surface-900 dark:text-white">Class dues</h2>
          <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
            Create, view and deactivate dues for your class
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-surface-400">Loading dues...</div>
        ) : dues.length === 0 ? (
          <div className="py-16 text-center text-xs text-surface-400 dark:text-slate-500">
            No class dues created yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 dark:text-slate-400 uppercase text-[10px] text-left">
                  <th className="py-3 px-3 font-semibold">Due</th>
                  <th className="py-3 px-3 font-semibold text-right">Amount</th>
                  <th className="py-3 px-3 font-semibold">Collected</th>
                  <th className="py-3 px-3 font-semibold text-center">Status</th>
                  <th className="py-3 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60">
                {dues.map((d) => {
                  const paidForDue = completedPayments
                    .filter((p) => p.due_id === d.id)
                    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
                  const expectedForDue = (Number(d.amount) || 0) * (students.length || 1);
                  const pct = expectedForDue > 0 ? Math.min(100, Math.round((paidForDue / expectedForDue) * 100)) : 0;
                  const deadlineDate = d.deadline
                    ? new Date(d.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : '30 Nov';

                  return (
                    <tr key={d.id} className="hover:bg-surface-50 dark:hover:bg-[#152033]/40 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033] text-surface-400 mt-0.5 shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-surface-900 dark:text-white">{d.name}</p>
                            <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                              {d.description || 'Class fee'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-surface-900 dark:text-white">
                        {formatCurrency(d.amount)}
                      </td>

                      <td className="py-3.5 px-3 min-w-[160px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-surface-800 dark:text-slate-200">{pct}% paid</span>
                            <span className="text-surface-400 dark:text-slate-400 text-[11px]">{deadlineDate}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-surface-200 dark:bg-[#152033] overflow-hidden">
                            <div
                              className="h-full bg-[#1d68ec] rounded-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        {d.is_active ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        {d.is_active ? (
                          <button
                            onClick={() => handleDeactivate(d)}
                            className="px-3 py-1.5 rounded-xl border border-surface-300 dark:border-[#223352] text-xs font-semibold text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] transition-colors cursor-pointer"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <span className="text-xs text-surface-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Due Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-surface-200 dark:border-[#1e2a42] bg-white dark:bg-[#0c1322] p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-surface-900 dark:text-white">Create new due</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-surface-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDue} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-700 dark:text-slate-300">Due Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Class fees"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#080d18] border border-surface-300 dark:border-[#1e2a42] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-700 dark:text-slate-300">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Handouts and class activities"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#080d18] border border-surface-300 dark:border-[#1e2a42] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-surface-700 dark:text-slate-300">Amount (₦)</label>
                  <input
                    type="number"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="2500"
                    className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#080d18] border border-surface-300 dark:border-[#1e2a42] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec] font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-surface-700 dark:text-slate-300">Level</label>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#080d18] border border-surface-300 dark:border-[#1e2a42] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec] cursor-pointer"
                  >
                    <option value="all">All levels</option>
                    <option value="1">100L</option>
                    <option value="2">200L</option>
                    <option value="3">300L</option>
                    <option value="4">400L</option>
                    <option value="5">500L</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-surface-700 dark:text-slate-300">
                  Deadline (optional)
                </label>
                <input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#080d18] border border-surface-300 dark:border-[#1e2a42] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-300 dark:border-[#1e2a42] text-xs font-semibold text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create due'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
