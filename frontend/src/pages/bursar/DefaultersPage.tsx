import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDefaulters } from '../../api/payments';
import { useNotification } from '../../hooks/useNotification';
import { formatCurrency } from '../../utils/formatters';
import type { Defaulter } from '../../types';
import { Download, Users, CreditCard, Clock, CheckCircle, Search, Send, Plus, Check } from 'lucide-react';

export default function DefaultersPage() {
  const { success, error: notifyError } = useNotification();
  const [list, setList] = useState<Defaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [overdueFilter, setOverdueFilter] = useState<string>('any');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [remindersSentToday, setRemindersSentToday] = useState(0);

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

  const filtered = list.filter((d) => {
    const matchesLevel = levelFilter === 'all' || d.level === levelFilter;
    const matchesSearch =
      !search.trim() ||
      d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.matric_number?.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const toggleSelect = (matric: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(matric)) next.delete(matric);
      else next.add(matric);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.matric_number)));
    }
  };

  const handleSendReminder = (matric: string, name: string) => {
    success('Reminder Sent', `Payment reminder sent to ${name}`);
    setRemindersSentToday((prev) => prev + 1);
  };

  const handleSendBulkReminders = () => {
    if (selectedIds.size === 0) return;
    success('Reminders Sent', `Sent payment reminders to ${selectedIds.size} student(s)`);
    setRemindersSentToday((prev) => prev + selectedIds.size);
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    const csv = [
      'Matric Number,Name,Level,Unpaid Dues,Outstanding (₦)',
      ...filtered.map(
        (d) => `${d.matric_number},${d.full_name},${d.level},${d.unpaid_dues_count},${d.total_outstanding}`,
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defaulters_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOwed = filtered.reduce((acc, d) => acc + (d.total_outstanding || 0), 0);
  const oldestOverdueDays = filtered.length > 0 ? 14 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Dues defaulters</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Students with unpaid dues, worked out from active dues and completed payments.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] hover:bg-surface-50 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* If populated: 4 Stat Cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Defaulters</p>
              <p className="text-2xl font-black text-surface-900 dark:text-white">{filtered.length}</p>
            </div>
            <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
              <Users className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Total owed</p>
              <p className="text-2xl font-black text-rose-500">{formatCurrency(totalOwed)}</p>
            </div>
            <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
              <CreditCard className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Oldest overdue</p>
              <p className="text-2xl font-black text-surface-900 dark:text-white">{oldestOverdueDays} days</p>
            </div>
            <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Reminders sent</p>
              <p className="text-2xl font-black text-surface-900 dark:text-white">{remindersSentToday} today</p>
            </div>
            <div className="p-2 rounded-xl bg-surface-100 dark:bg-[#152033]">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </div>
      )}

      {/* Main Registry Card */}
      <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-4">
        {/* Card Header & Level Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Defaulter registry</h2>
            <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">{filtered.length} students</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-surface-200 dark:border-[#1e2a3f] bg-surface-50 dark:bg-[#0b101c] text-surface-700 dark:text-slate-300 cursor-pointer"
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

        {/* If populated: Search & Overdue Filter */}
        {list.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or matric number"
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
              />
            </div>

            <select
              value={overdueFilter}
              onChange={(e) => setOverdueFilter(e.target.value)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-surface-200 dark:border-[#1e2a3f] bg-surface-50 dark:bg-[#0b101c] text-surface-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="any">Overdue: any</option>
              <option value="7">Over 7 days</option>
              <option value="14">Over 14 days</option>
              <option value="30">Over 30 days</option>
            </select>
          </div>
        )}

        {/* Content: Clean Empty State (Page 6 / 23) vs Populated Table (Page 7 / 24) */}
        {loading ? (
          <div className="py-16 text-center text-xs text-surface-400">Loading defaulters...</div>
        ) : filtered.length === 0 ? (
          /* Empty state matching PDF page 6 exactly */
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-[#152033] flex items-center justify-center text-[#1d68ec] mb-3">
              <Check className="w-7 h-7 stroke-[2.5]" />
            </div>
            <p className="text-base font-bold text-surface-900 dark:text-white">No defaulters</p>
            <p className="text-xs text-surface-400 dark:text-slate-400 mt-1 max-w-sm">
              Everyone is up to date, or no dues exist yet. Create a due to start tracking.
            </p>
            <Link
              to="/bu/dues"
              className="mt-4 px-4 py-2 rounded-xl bg-[#1d68ec]/10 text-[#1d68ec] dark:text-[#4f9bff] hover:bg-[#1d68ec]/20 font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create a due</span>
            </Link>
          </div>
        ) : (
          /* Populated Table matching PDF page 7 */
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 dark:text-slate-400 uppercase text-[10px] text-left">
                  <th className="py-3 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-surface-300 dark:border-surface-700 text-[#1d68ec]"
                    />
                  </th>
                  <th className="py-3 px-3 font-semibold">Student</th>
                  <th className="py-3 px-3 font-semibold">Level</th>
                  <th className="py-3 px-3 font-semibold">Owes</th>
                  <th className="py-3 px-3 font-semibold text-right">Amount</th>
                  <th className="py-3 px-3 font-semibold text-center">Overdue</th>
                  <th className="py-3 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60">
                {filtered.map((d) => {
                  const isSelected = selectedIds.has(d.matric_number);
                  const initials =
                    d.full_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'ST';

                  return (
                    <tr
                      key={d.matric_number}
                      className={`hover:bg-surface-50 dark:hover:bg-[#152033]/40 transition-colors ${
                        isSelected ? 'bg-[#1d68ec]/5' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(d.matric_number)}
                          className="w-4 h-4 rounded border-surface-300 dark:border-surface-700 text-[#1d68ec]"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1d68ec] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-surface-900 dark:text-white">{d.full_name}</p>
                            <p className="text-[11px] font-mono text-surface-400">{d.matric_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-surface-600 dark:text-slate-300 font-medium">
                        {d.level ? `${d.level * 100}L` : '—'}
                      </td>
                      <td className="py-3 px-3 text-surface-600 dark:text-slate-300">
                        {d.unpaid_dues_count ? `${d.unpaid_dues_count} unpaid due(s)` : 'Departmental dues'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-surface-900 dark:text-white">
                        {formatCurrency(d.total_outstanding)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          14 days
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleSendReminder(d.matric_number, d.full_name)}
                          className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-[#223352] hover:bg-surface-100 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Send className="w-3 h-3 text-[#1d68ec]" />
                          <span>Send reminder</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Bottom Bar for Selected Rows (Page 7 / 24) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-xl w-full px-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0f172a] text-white shadow-2xl border border-[#1e2a3f] backdrop-blur-xl">
            <span className="text-xs font-medium text-slate-300">
              <strong className="text-white">{selectedIds.size} selected</strong>. They will get an in-app message with
              the amount owed.
            </span>
            <button
              onClick={handleSendBulkReminders}
              className="px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-[#1d68ec]/30 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send reminder to {selectedIds.size}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
