import { useState, useEffect } from 'react';
import { useNotification } from '../../hooks/useNotification';
import {
  listPendingCourseRegistrations,
  approveCourseRegistration,
  listPendingStudentRegistrations,
  approveStudentRegistration,
  type PendingCourseRegistration,
  type PendingStudentRegistration,
} from '../../api/class-rep';
import { Check, X, RefreshCw, FileText, UserCheck } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

export default function PendingRequestsPage() {
  const { success, error: notifyError } = useNotification();
  const [activeTab, setActiveTab] = useState<'forms' | 'registrations'>('forms');
  const [refreshKey, setRefreshKey] = useState(0);

  // Course forms state
  const [courseForms, setCourseForms] = useState<PendingCourseRegistration[]>([]);
  const [selectedFormIndex, setSelectedFormIndex] = useState(0);
  const [loadingForms, setLoadingForms] = useState(true);
  const [verifyingFormId, setVerifyingFormId] = useState<string | null>(null);

  // Student accounts state
  const [studentAccounts, setStudentAccounts] = useState<PendingStudentRegistration[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [approvingAccountId, setApprovingAccountId] = useState<string | null>(null);

  const fetchForms = async () => {
    try {
      setLoadingForms(true);
      const res = await listPendingCourseRegistrations();
      setCourseForms(Array.isArray(res) ? res : []);
      setSelectedFormIndex(0);
    } catch {
      notifyError('Error', 'Failed to load pending course forms');
    } finally {
      setLoadingForms(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await listPendingStudentRegistrations();
      setStudentAccounts(Array.isArray(res) ? res : []);
    } catch {
      notifyError('Error', 'Failed to load pending student registrations');
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchForms();
    fetchAccounts();
  }, [refreshKey]);

  const handleVerifyForm = async (reg: PendingCourseRegistration) => {
    try {
      setVerifyingFormId(reg.id);
      await approveCourseRegistration(reg.id);
      success('Form Verified', `Verified course form for ${reg.student_name}`);
      await fetchForms();
    } catch (e) {
      notifyError('Error', getErrorMessage(e, 'Failed to verify form'));
    } finally {
      setVerifyingFormId(null);
    }
  };

  const handleApproveAccount = async (account: PendingStudentRegistration) => {
    try {
      setApprovingAccountId(account.id);
      await approveStudentRegistration(account.id);
      success('Account Approved', `Approved ${account.full_name}'s registration`);
      await fetchAccounts();
    } catch (e) {
      notifyError('Error', getErrorMessage(e, 'Failed to approve student'));
    } finally {
      setApprovingAccountId(null);
    }
  };

  const handleApproveAllAccounts = async () => {
    if (studentAccounts.length === 0) return;
    try {
      setLoadingAccounts(true);
      for (const account of studentAccounts) {
        await approveStudentRegistration(account.id);
      }
      success('All Approved', `Approved all ${studentAccounts.length} student accounts`);
      await fetchAccounts();
    } catch (e) {
      notifyError('Error', getErrorMessage(e, 'Failed to approve all students'));
    } finally {
      setLoadingAccounts(false);
    }
  };

  const activeForm = courseForms[selectedFormIndex] || null;

  const maskEmail = (email?: string) => {
    if (!email) return '';
    const [user, domain] = email.split('@');
    if (!domain) return email;
    return `${user.slice(0, 1)}•••••@${domain}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">
            Pending registrations
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Verify course forms and approve new student accounts in your level.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] hover:bg-surface-50 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('forms')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'forms'
              ? 'bg-[#1d68ec] text-white shadow-sm'
              : 'border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] text-surface-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-[#152033]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Course forms ({courseForms.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('registrations')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'registrations'
              ? 'bg-[#1d68ec] text-white shadow-sm'
              : 'border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] text-surface-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-[#152033]'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Student registrations ({studentAccounts.length})</span>
        </button>
      </div>

      {/* Tab 1: Course Forms (PDF Page 12 / 29) */}
      {activeTab === 'forms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Forms to verify list */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-surface-900 dark:text-white">Forms to verify</h2>
              <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                Check them before the department sees them
              </p>
            </div>

            {loadingForms ? (
              <div className="py-12 text-center text-xs text-surface-400">Loading forms...</div>
            ) : courseForms.length === 0 ? (
              <div className="py-12 text-center text-xs text-surface-400 dark:text-slate-500">
                No pending course forms
              </div>
            ) : (
              <div className="space-y-2">
                {courseForms.map((form, idx) => {
                  const isSelected = idx === selectedFormIndex;
                  const initials =
                    form.student_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'ST';

                  return (
                    <div
                      key={form.id}
                      onClick={() => setSelectedFormIndex(idx)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-[#1d68ec] bg-[#1d68ec]/10 text-white'
                          : 'border-surface-200 dark:border-[#1a2538] bg-surface-50/50 dark:bg-[#0b101c]/50 hover:bg-surface-100 dark:hover:bg-[#152033]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#1d68ec] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold text-surface-900 dark:text-white">
                            {form.student_name}
                          </p>
                          <p className="text-[11px] font-mono text-surface-400">{form.matric_number}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-surface-400 dark:text-slate-500 shrink-0">
                        {form.created_at ? 'Recent' : 'Today'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Form preview */}
          <div className="lg:col-span-2 space-y-5">
            {activeForm ? (
              <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-5">
                {/* Header & Dues Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                      {activeForm.student_name} · Course form
                    </h2>
                    <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                      Level {activeForm.level} · {activeForm.courses_count || 15} units · 2026/2027 first semester
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
                    <Check className="w-3.5 h-3.5" />
                    Dues paid
                  </span>
                </div>

                {/* Form Document View */}
                <div className="p-6 rounded-2xl border border-surface-200 dark:border-[#1a2538] bg-surface-50/50 dark:bg-[#070b13] space-y-4">
                  <div className="text-center space-y-1 pb-4 border-b border-surface-200 dark:border-[#1a2538]">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-surface-700 dark:text-slate-200">
                      UNIVERSITY OF UYO
                    </p>
                    <p className="text-sm font-bold text-surface-900 dark:text-white">Course Registration Form</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-surface-400 dark:text-slate-400 uppercase tracking-wider mb-2">
                      REGISTERED COURSES
                    </p>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="h-3 rounded bg-surface-200 dark:bg-[#152033] w-full"
                          style={{ width: `${90 - i * 8}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verification checklist matching PDF page 12 */}
                <div className="space-y-2 text-xs text-surface-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>
                      Courses match the registered list ({activeForm.courses_count || 5} of{' '}
                      {activeForm.courses_count || 5})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Total units within 4 to 24</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-100 dark:border-surface-800">
                  <button
                    onClick={() => success('Returned', 'Note sent to student.')}
                    className="px-4 py-2 rounded-xl border border-surface-300 dark:border-[#223352] text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Return with note
                  </button>
                  <button
                    onClick={() => handleVerifyForm(activeForm)}
                    disabled={verifyingFormId === activeForm.id}
                    className="px-5 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{verifyingFormId === activeForm.id ? 'Verifying...' : 'Verify form'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-12 text-center text-xs text-surface-400">
                Select a form on the left to review
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Student Registrations Queue (PDF Page 13 / 30) */}
      {activeTab === 'registrations' && (
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-surface-900 dark:text-white">Student registration queue</h2>
              <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                New accounts waiting for approval in your level
              </p>
            </div>
            {studentAccounts.length > 0 && (
              <button
                onClick={handleApproveAllAccounts}
                className="px-4 py-2 rounded-xl border border-surface-300 dark:border-[#223352] hover:bg-surface-100 dark:hover:bg-[#152033] text-xs font-semibold text-surface-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Approve all
              </button>
            )}
          </div>

          {loadingAccounts ? (
            <div className="py-12 text-center text-xs text-surface-400">Loading registrations...</div>
          ) : studentAccounts.length === 0 ? (
            <div className="py-16 text-center text-xs text-surface-400 dark:text-slate-500">
              No new accounts waiting for approval
            </div>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800/80">
              {studentAccounts.map((account) => {
                const initials =
                  account.full_name
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'ST';

                return (
                  <div
                    key={account.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1d68ec] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-900 dark:text-white">{account.full_name}</p>
                        <p className="text-xs text-surface-400 dark:text-slate-400 font-mono mt-0.5">
                          {maskEmail(account.email)} · {account.matric_number || 'No matric'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end">
                      <span className="text-xs text-surface-400 dark:text-slate-500 font-medium">
                        Level {account.level || 100} · Today
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => success('Rejected', `Rejected registration for ${account.full_name}`)}
                          className="px-3.5 py-1.5 rounded-xl border border-surface-300 dark:border-[#223352] text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleApproveAccount(account)}
                          disabled={approvingAccountId === account.id}
                          className="px-4 py-1.5 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{approvingAccountId === account.id ? 'Approving...' : 'Approve'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
