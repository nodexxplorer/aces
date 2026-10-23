import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getAllDues, createDue, updateDue, deleteDue, getAllPayments } from '../../api/payments';
import { getStudents } from '../../api/users';
import { getSessions } from '../../api/sessions';
import type { DuePayment, Payment, User, Session } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { DuesNavHeader, type DuesTabKey } from '../../components/finance/DuesNavHeader';
import { RevenueForecastPage } from '../admin/RevenueForecastPage';
import {
  CreditCard,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  MoreVertical,
  AlertCircle,
  ArrowRight,
  BarChart3,
} from 'lucide-react';

const formatNaira = (v: number | string) => {
  return `₦${Number(v || 0).toLocaleString()}`;
};

type DueTypeTab = 'class_dues' | 'dept_dues';

interface IdeaTemplate {
  title: string;
  subtitle: string;
  type: DueTypeTab;
  amount: string;
  level: number | 'all';
}

const IDEAS: IdeaTemplate[] = [
  {
    title: 'Departmental dues',
    subtitle: 'Yearly contribution to the department',
    type: 'dept_dues',
    amount: '5000',
    level: 'all',
  },
  {
    title: 'Class fees',
    subtitle: 'Handouts and class activities',
    type: 'class_dues',
    amount: '2500',
    level: 500,
  },
  {
    title: 'Excursion fund',
    subtitle: 'Optional department trip',
    type: 'dept_dues',
    amount: '1500',
    level: 'all',
  },
];

export default function DuesPage() {
  // const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const mainTab: DuesTabKey = rawTab === 'forecast' ? 'forecast' : rawTab === 'transactions' ? 'transactions' : 'dues';

  const { user } = useAuth();
  // const urlCode = user?.tenant?.urlCode;
  const { success, error: notifyError } = useNotification();

  const [activeTab, setActiveTab] = useState<DueTypeTab>('class_dues');
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [, setLoading] = useState(true);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Drawer / modal state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDue, setEditingDue] = useState<DuePayment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Drawer form fields
  const [formType, setFormType] = useState<DueTypeTab>('class_dues');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formLevel, setFormLevel] = useState<number | 'all'>('all');
  const [formSessionId, setFormSessionId] = useState('');
  const [formIsRequired, setFormIsRequired] = useState(true);
  const [formNotifyStudents, setFormNotifyStudents] = useState(true);

  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [duesRes, paymentsRes, studentsRes, sessionsRes] = await Promise.allSettled([
        getAllDues({ limit: 100 }),
        getAllPayments({ limit: 500 }),
        getStudents({ perPage: 100 }),
        getSessions(),
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
      if (sessionsRes.status === 'fulfilled') {
        const sList = Array.isArray(sessionsRes.value) ? sessionsRes.value : [];
        setSessions(sList);
        const curr = sList.find((s) => s.is_active);
        if (curr && !formSessionId) {
          setFormSessionId(curr.id);
        }
      }
    } catch {
      notifyError('Error', 'Failed to load dues registry');
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

  // Open drawer with optional template prefill
  const handleOpenCreate = (template?: IdeaTemplate) => {
    setEditingDue(null);
    if (template) {
      setFormType(template.type);
      setFormName(template.title);
      setFormDescription(template.subtitle);
      setFormAmount(template.amount);
      setFormLevel(template.level);
    } else {
      setFormType(activeTab);
      setFormName('');
      setFormDescription('');
      setFormAmount('');
      setFormLevel('all');
    }
    setFormDeadline('');
    setFormIsRequired(true);
    setFormNotifyStudents(true);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (due: DuePayment) => {
    setEditingDue(due);
    setFormType((due.type as DueTypeTab) || 'class_dues');
    setFormName(due.name);
    setFormDescription(due.description || '');
    setFormAmount(String(due.amount));
    setFormDeadline(due.deadline ? due.deadline.slice(0, 10) : '');
    setFormLevel(due.level ?? 'all');
    setFormSessionId(due.session_id || '');
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setEditingDue(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAmount || !user?.id) return;

    try {
      setSubmitting(true);
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        type: formType,
        amount: formAmount,
        level: formLevel === 'all' ? undefined : Number(formLevel),
        session_id: formSessionId || undefined,
        deadline: formDeadline ? new Date(formDeadline).toISOString() : undefined,
      };

      if (editingDue) {
        await updateDue(editingDue.id, { ...payload, amount: Number(payload.amount) });
        success('Due Updated', `"${formName}" updated successfully.`);
      } else {
        await createDue(payload);
        success('Due Created', `"${formName}" created successfully.`);
      }
      handleCloseDrawer();
      fetchData();
    } catch (err: unknown) {
      notifyError('Failed', getErrorMessage(err, 'Could not save due'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (due: DuePayment) => {
    if (!confirm(`Are you sure you want to deactivate "${due.name}"?`)) return;
    try {
      await deleteDue(due.id);
      success('Deactivated', `"${due.name}" has been deactivated.`);
      fetchData();
    } catch {
      notifyError('Error', 'Could not deactivate due.');
    }
  };

  // Filter dues by current tab (class dues vs department dues)
  const tabDues = useMemo(() => {
    return dues.filter((d) => d.type === activeTab);
  }, [dues, activeTab]);

  const classDuesCount = useMemo(() => dues.filter((d) => d.type === 'class_dues').length, [dues]);
  const deptDuesCount = useMemo(() => dues.filter((d) => d.type === 'dept_dues').length, [dues]);

  // Real stat calculations
  const activeDuesCount = useMemo(() => {
    return dues.filter((d) => d.is_active).length;
  }, [dues]);

  const totalExpected = useMemo(() => {
    if (dues.length === 0) return 0;
    return dues.reduce((acc, d) => {
      const studentCount = d.level ? students.filter((s) => s.level === d.level).length : Math.max(students.length, 1);
      return acc + (Number(d.amount) || 0) * (studentCount || 1);
    }, 0);
  }, [dues, students]);

  const totalCollected = useMemo(() => {
    return completedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [completedPayments]);

  const collectionRate = useMemo(() => {
    if (totalExpected <= 0 || totalCollected <= 0) return 0;
    return Math.min(100, Math.round((totalCollected / totalExpected) * 100));
  }, [totalCollected, totalExpected]);

  // Apply filters on the active tab dues
  const filteredDues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tabDues.filter((d) => {
      const matchesSearch =
        !q || d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q));
      const matchesLevel = levelFilter === 'all' || (d.level !== undefined && String(d.level) === levelFilter);
      const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? d.is_active : !d.is_active;
      return matchesSearch && matchesLevel && matchesStatus;
    });
  }, [tabDues, searchQuery, levelFilter, statusFilter]);

  // If user selected forecast tab, render full forecast
  if (mainTab === 'forecast') {
    return <RevenueForecastPage />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        {/* ─── HEADER & SUB-NAVIGATION ─── */}
        <DuesNavHeader
          activeTab="dues"
          title="Dues"
          subtitle="Manage class and department dues in one place."
          rightAction={
            <button
              type="button"
              onClick={() => handleOpenCreate()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-blue-600 text-white shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create due</span>
            </button>
          }
        />

        {/* ─── CLASS DUES / DEPARTMENT DUES PILLS ─── */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('class_dues')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'class_dues'
                ? 'bg-[#1a66d6] text-white shadow-xs'
                : 'bg-white dark:bg-[#131722] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Class dues {classDuesCount > 0 ? `(${classDuesCount})` : ''}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dept_dues')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'dept_dues'
                ? 'bg-[#1a66d6] text-white shadow-xs'
                : 'bg-white dark:bg-[#131722] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Department dues {deptDuesCount > 0 ? `(${deptDuesCount})` : ''}
          </button>
        </div>

        {/* ─── IF POPULATED (dues exist in department) ─── */}
        {dues.length > 0 ? (
          <>
            {/* 4 Stat Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active dues</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
                  {activeDuesCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total expected</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
                  {formatNaira(totalExpected)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Collected</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-500 mt-3 tracking-tight">
                  {formatNaira(totalCollected)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Collection rate</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
                  {collectionRate}%
                </p>
              </div>
            </div>

            {/* Filter Row: Search dues, Level filter, Status filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dues"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">All levels</option>
                  <option value="100">100 Level</option>
                  <option value="200">200 Level</option>
                  <option value="300">300 Level</option>
                  <option value="400">400 Level</option>
                  <option value="500">500 Level</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                  className="px-3 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            {/* Dues Table */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">Due</th>
                      <th className="py-3.5 px-6">Audience</th>
                      <th className="py-3.5 px-6">Amount</th>
                      <th className="py-3.5 px-6">Collected</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredDues.length > 0 ? (
                      filteredDues.map((due) => {
                        const duePayments = completedPayments.filter(
                          (p) => p.due_id === due.id || p.due_name === due.name,
                        );
                        const collectedSum = duePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
                        const studentCount = due.level
                          ? students.filter((s) => s.level === due.level).length
                          : Math.max(students.length, 1);
                        const expectedSum = (Number(due.amount) || 0) * (studentCount || 1);
                        const pct = expectedSum > 0 ? Math.min(100, Math.round((collectedSum / expectedSum) * 100)) : 0;

                        return (
                          <tr
                            key={due.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                  <CreditCard className="w-4 h-4 text-[#1a66d6]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 dark:text-white truncate">{due.name}</p>
                                  {due.description && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      {due.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-medium">
                              {due.level ? `${due.level} Level` : 'All levels'}
                            </td>

                            <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                              {formatNaira(due.amount)}
                            </td>

                            <td className="py-4 px-6">
                              <div className="space-y-1.5 min-w-[130px] max-w-[180px]">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{pct}% paid</span>
                                  <span className="text-slate-400">
                                    {due.deadline
                                      ? new Date(due.deadline).toLocaleDateString('en-GB', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })
                                      : '—'}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-[#1a66d6] rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6">
                              {due.is_active ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Inactive
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-6 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(due)}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                                >
                                  Edit
                                </button>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setOpenActionMenuId(openActionMenuId === due.id ? null : due.id)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  {openActionMenuId === due.id && (
                                    <div className="absolute right-0 mt-1 w-36 rounded-xl bg-white dark:bg-[#1a1f2e] border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          handleDelete(due);
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Deactivate</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No dues match your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* ─── IF 0 DUES (EMPTY STATE MATCHING SCREENSHOT 5) ─── */
          <div className="space-y-6">
            {/* Title: Class dues registry, 0 dues found */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeTab === 'class_dues' ? 'Class dues registry' : 'Department dues registry'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Create, view and deactivate {activeTab === 'class_dues' ? 'class-level' : 'departmental'} dues
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">0 dues found</span>
            </div>

            {/* Empty State Box */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-10 sm:p-14 text-center flex flex-col items-center justify-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center mb-4">
                <CreditCard className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">No dues yet</h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-5">
                Create a due so students can pay it from their portal. You will see every payment under Transactions.
              </p>
              <button
                type="button"
                onClick={() => handleOpenCreate()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#1a66d6] hover:bg-blue-600 text-white shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create due</span>
              </button>
            </div>

            {/* Info callout */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-4 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-[#1a66d6] shrink-0" />
              <span>
                <strong>Class dues</strong> are collected for a class and verified by the class bursar.{' '}
                <strong>Department dues</strong> are association dues paid to the department.
              </span>
            </div>

            {/* "Ideas to start with" Gallery */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Ideas to start with</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {IDEAS.map((idea) => (
                  <div
                    key={idea.title}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#131722] p-5 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#1a66d6] flex items-center justify-center mb-3">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{idea.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{idea.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCreate(idea)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1a66d6] hover:underline mt-4 self-start"
                    >
                      <span>Use this idea</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── CREATE / EDIT DUE DRAWER (MATCHING SCREENSHOT 3) ─── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={handleCloseDrawer}
          />

          {/* Slide-over panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-[#131722] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingDue ? 'Edit due' : 'Create due'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Students will see it in Payments &amp; Dues
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Form Body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Type toggle */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Type</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('class_dues')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                        formType === 'class_dues'
                          ? 'bg-[#1a66d6] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Class due
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('dept_dues')}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                        formType === 'dept_dues'
                          ? 'bg-[#1a66d6] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Department due
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Departmental dues"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                  />
                </div>

                {/* Amount and Deadline */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Amount (₦) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="5000"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                    />
                  </div>
                </div>

                {/* Who pays? Level audience chips */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Who pays?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 100, 200, 300, 400, 500] as const).map((lvl) => (
                      <button
                        key={String(lvl)}
                        type="button"
                        onClick={() => setFormLevel(lvl)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          formLevel === lvl
                            ? 'bg-[#1a66d6] text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {lvl === 'all' ? 'All levels' : `${lvl}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Session
                  </label>
                  <select
                    value={formSessionId}
                    onChange={(e) => setFormSessionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {sessions.length > 0 ? (
                      sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.is_active ? '(Current)' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="">Current Academic Session</option>
                    )}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Yearly departmental contribution"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a66d6]"
                  />
                </div>

                {/* Toggles: Required & Notify */}
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Required</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Students must pay before course form signing
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormIsRequired(!formIsRequired)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        formIsRequired ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform mt-0.5 ml-0.5 ${
                          formIsRequired ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Notify students</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Send an in-app notification</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormNotifyStudents(!formNotifyStudents)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        formNotifyStudents ? 'bg-[#1a66d6]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform mt-0.5 ml-0.5 ${
                          formNotifyStudents ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Drawer Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1a66d6] hover:bg-blue-600 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingDue ? 'Save changes' : 'Create due'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
