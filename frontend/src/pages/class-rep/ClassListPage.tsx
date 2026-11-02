import { useState, useEffect } from 'react';
import { getClassRepClassList, type ClassRepStudent } from '../../api/class-rep';
import { useNotification } from '../../hooks/useNotification';
import { Search, Download, Check, AlertTriangle, Eye, WifiOff } from 'lucide-react';

export default function ClassListPage() {
  const { error: notifyError } = useNotification();
  const [students, setStudents] = useState<ClassRepStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    getClassRepClassList()
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => notifyError('Error', 'Failed to load class list'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.matric_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleExportCSV = () => {
    const csv = [
      'Student Name,Matric Number,Email,Status',
      ...filtered.map(
        (s) => `"${s.full_name}","${s.matric_number}","${s.email}","${s.is_defaulter ? 'Defaulter' : 'Active'}"`,
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class_list_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maskEmail = (email?: string) => {
    if (!email) return '—';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    return `${user.slice(0, 1)}•••••@${domain}`;
  };

  return (
    <div className="space-y-6">
      {/* Offline notification banner if offline */}
      {isOffline && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#1d68ec] text-white text-xs font-medium shadow-md">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Low network. Your changes are saved on this device and will sync when you are back online.</span>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white/20 text-white font-semibold text-[11px]">Saved offline</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Class list</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">Browse students registered in your level.</p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, matric number or email"
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#111927] border border-surface-200 dark:border-surface-800 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] text-xs font-semibold text-surface-700 dark:text-slate-300">
            {filtered.length} students
          </span>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] hover:bg-surface-50 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-surface-900 dark:text-white">Class members</h2>
          <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">Students under your level coordination</p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-surface-400">Loading class list...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-surface-400 dark:text-slate-500">
            No students found in your class level
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 dark:text-slate-400 uppercase text-[10px] text-left">
                  <th className="py-3 px-3 font-semibold">Student</th>
                  <th className="py-3 px-3 font-semibold">Matric Number</th>
                  <th className="py-3 px-3 font-semibold">Email</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60">
                {filtered.map((s) => {
                  const initials =
                    s.full_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'ST';

                  return (
                    <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-[#152033]/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-surface-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1d68ec] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <span>{s.full_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-surface-600 dark:text-slate-300">
                        {s.matric_number || '—'}
                      </td>
                      <td className="py-3 px-3 text-xs text-surface-500 dark:text-slate-400 font-mono">
                        {maskEmail(s.email)}
                      </td>
                      <td className="py-3 px-3">
                        {s.is_defaulter ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Defaulter
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button className="p-1.5 rounded-lg text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors cursor-pointer">
                          <Eye className="w-4 h-4" />
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
    </div>
  );
}
