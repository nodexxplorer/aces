import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { useCurrentDepartment } from '../../components/branding/department';
import { Printer, Download, Loader2, Mail, Search, Users } from 'lucide-react';
import { listLecturerAssignments, type LecturerAssignment } from '../../api/lecturers';
import { getCourseClassList } from '../../api/courses';
import { getInitials } from '../../utils/formatters';

interface StudentRow {
  studentId?: string;
  matricNumber: string;
  name: string;
  courseCode: string;
  status: string;
  level: number;
}

const PAGE_SIZE = 10;

function statusLabel(status: string) {
  if (!status) return 'Registered';
  const s = status.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ClassListPage = () => {
  const { user } = useAuth();
  const { error: notifyError, success } = useNotification();
  const department = useCurrentDepartment();
  const contactEmail = department?.approvalContactEmail || department?.contactEmail || '';
  const [searchParams, setSearchParams] = useSearchParams();

  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [countsByAssignment, setCountsByAssignment] = useState<Record<string, number>>({});
  const [loadingA, setLoadingA] = useState(true);
  const [loadingS, setLoadingS] = useState(false);
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [levelFilter, setLevelFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user?.id) return;
    listLecturerAssignments(user.id)
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setAssignments(arr);
        const fromUrl = searchParams.get('course');
        const match = fromUrl ? arr.find((a) => a.course_id === fromUrl || a.id === fromUrl) : null;
        if (match) setSelectedId(match.id);
        else if (arr.length > 0) setSelectedId(arr[0].id);
      })
      .catch(() => notifyError('Error', 'Failed to load assignments'))
      .finally(() => setLoadingA(false));
  }, [user?.id, notifyError, searchParams]);

  const sel = assignments.find((a) => a.id === selectedId);

  const load = useCallback(async () => {
    if (!sel) {
      setStudents([]);
      return;
    }
    setLoadingS(true);
    try {
      const res = await getCourseClassList(sel.course_id);
      const rows = (res || []).map((r) => ({
        studentId: r.student_id,
        matricNumber: r.matric_number || '',
        name: r.name || '',
        courseCode: sel.course_code,
        status: r.status || 'enrolled',
        level: r.level || sel.level || 0,
      }));
      setStudents(rows);
      setCountsByAssignment((prev) => ({ ...prev, [sel.id]: rows.length }));
    } catch {
      setStudents([]);
    } finally {
      setLoadingS(false);
    }
  }, [sel]);

  useEffect(() => {
    load();
    setPage(1);
  }, [load]);

  const levels = useMemo(() => {
    const set = new Set(students.map((s) => s.level).filter((n) => n > 0));
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (levelFilter !== 'all' && String(s.level) !== levelFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.matricNumber.toLowerCase().includes(q);
    });
  }, [students, query, levelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const registeredCount = students.filter((s) =>
    ['enrolled', 'registered', 'submitted', 'approved', 'confirmed'].includes(s.status.toLowerCase()),
  ).length;

  const handleExport = () => {
    if (!students.length) return;
    const rows = [
      'Matric,Name,Level,Status,Course',
      ...filtered.map((s) => `${s.matricNumber},${s.name},${s.level || ''},${s.status},${s.courseCode}`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `class_list_${sel?.course_code || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success('Downloaded', 'Class list exported as CSV.');
  };

  const selectAssignment = (id: string) => {
    setSelectedId(id);
    const found = assignments.find((a) => a.id === id);
    if (found) {
      const next = new URLSearchParams(searchParams);
      next.set('course', found.course_id);
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Class lists</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Student rosters for the courses you teach.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922]"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!students.length}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {loadingA ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#1d68ec] mr-2" />
          Loading courses...
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No students to show yet</h3>
          <p className="text-sm text-slate-500 mt-1">Students appear here once they register for a course you teach.</p>
          <p className="text-sm text-slate-500 mt-3">You have no courses assigned yet.</p>
          {contactEmail ? (
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent('Course assignment')}`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700"
            >
              <Mail className="w-4 h-4" />
              Contact the department
            </a>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {assignments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectAssignment(a.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  selectedId === a.id
                    ? 'border-[#1d68ec] bg-[#1d68ec]/10 text-[#1d68ec]'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] text-slate-700 dark:text-slate-200'
                }`}
              >
                {a.course_code}
                <span className="ml-2 text-xs font-medium text-slate-500">
                  {countsByAssignment[a.id] ?? a.enrolled_count ?? ''}
                </span>
              </button>
            ))}
          </div>

          {sel && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-5">
                <p className="text-xs text-slate-500">Enrolled</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{students.length}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {sel.course_code} · {sel.course_unit} units
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-5">
                <p className="text-xs text-slate-500">Registered</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {registeredCount} of {students.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-5">
                <p className="text-xs text-slate-500">Class rep</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {sel.class_rep_name || 'Not assigned'}
                </p>
                {sel.level ? <p className="text-xs text-slate-400 mt-1">Level {sel.level}</p> : null}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] overflow-hidden">
            <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or matric number"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>
              {levels.length > 0 && (
                <select
                  value={levelFilter}
                  onChange={(e) => {
                    setLevelFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm px-3 py-2"
                >
                  <option value="all">All levels</option>
                  {levels.map((lvl) => (
                    <option key={lvl} value={String(lvl)}>
                      {lvl}L
                    </option>
                  ))}
                </select>
              )}
            </div>

            {loadingS ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-[#1d68ec] mr-2" />
                Loading students...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                {students.length === 0
                  ? 'Students appear here once they register for a course you teach.'
                  : 'No students match this search.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-800">
                        {['#', 'Student', 'Matric no.', 'Level', 'Status'].map((h) => (
                          <th
                            key={h}
                            className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pageRows.map((s, i) => {
                        const parts = s.name.trim().split(/\s+/);
                        const initials = getInitials(parts[0] || '', parts[1] || '');
                        return (
                          <tr key={s.studentId || s.matricNumber || `${s.name}-${i}`}>
                            <td className="px-5 py-3 text-slate-400">{(pageSafe - 1) * PAGE_SIZE + i + 1}</td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#1d68ec] text-xs font-bold flex items-center justify-center">
                                  {initials || 'ST'}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-white">{s.name || '—'}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 font-mono text-xs">{s.matricNumber || '—'}</td>
                            <td className="px-5 py-3">{s.level ? `${s.level}L` : '—'}</td>
                            <td className="px-5 py-3">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {statusLabel(s.status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
                  <span>
                    Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} of{' '}
                    {filtered.length}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, n) => n + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPage(n)}
                          className={`w-8 h-8 rounded-lg font-semibold ${
                            n === pageSafe ? 'bg-[#1d68ec] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ClassListPage;
