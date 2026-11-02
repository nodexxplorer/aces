import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getAllDues } from '../../api/payments';
import { recordManualPayment } from '../../api/lecturers';
import { getStudents } from '../../api/users';
import type { DuePayment, User } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/formatters';
import { User as UserIcon, Check, AlertTriangle, Paperclip, Calendar, CreditCard, Info } from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'Cash', label: 'Cash' },
  { id: 'Bank transfer', label: 'Bank transfer' },
  { id: 'POS', label: 'POS' },
] as const;

export default function RecordPaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [students, setStudents] = useState<User[]>([]);
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedDueId, setSelectedDueId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank transfer' | 'POS'>('Cash');
  const [reference, setReference] = useState<string>('');
  const [datePaid, setDatePaid] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [duesRes, studentsRes] = await Promise.allSettled([getAllDues(), getStudents({ perPage: 150 })]);

        if (duesRes.status === 'fulfilled') {
          const arr = Array.isArray(duesRes.value) ? duesRes.value : [];
          const active = arr.filter((d) => d.is_active);
          setDues(active);
          if (active.length > 0) {
            setSelectedDueId(active[0].id);
            setAmount(String(active[0].amount));
          }
        }

        if (studentsRes.status === 'fulfilled') {
          const sArr = Array.isArray(studentsRes.value) ? studentsRes.value : [];
          setStudents(sArr);
          if (sArr.length > 0) {
            setSelectedStudentId(sArr[0].id);
          }
        }
      } catch {
        notifyError('Error', 'Failed to load dues and students');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDueChange = (dueId: string) => {
    setSelectedDueId(dueId);
    const found = dues.find((d) => d.id === dueId);
    if (found) {
      setAmount(String(found.amount));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFileName(e.target.files[0].name);
    }
  };

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedDue = dues.find((d) => d.id === selectedDueId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedDueId || !amount) {
      notifyError('Validation', 'Please fill all required payment fields');
      return;
    }

    try {
      setSubmitting(true);
      await recordManualPayment({
        student_id: selectedStudentId,
        due_id: selectedDueId,
        amount: amount,
        bank_name: paymentMethod,
        bank_reference: reference || undefined,
        notes: notes ? `${paymentMethod}: ${notes}` : paymentMethod,
      });

      success('Payment Recorded', `Manual payment of ₦${Number(amount).toLocaleString()} recorded.`);
      navigate(-1);
    } catch (err) {
      notifyError('Failed', getErrorMessage(err, 'Failed to record manual payment'));
    } finally {
      setSubmitting(false);
    }
  };

  const recordedByName = `${user?.firstName || 'Staff'} ${user?.lastName || ''}`.trim();
  const recordedByRole = user?.activeRole === 'class_bursar' ? 'Class bursar' : 'Bursar';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-surface-400 dark:text-slate-400 uppercase tracking-wider mb-1">
          Dues &amp; Payments
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">
          Record a manual payment
        </h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          For cash, transfers and POS payments made outside the portal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-5"
          >
            {/* Student selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Student</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec] cursor-pointer"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student'} ·{' '}
                      {s.matricNumber || s.email}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStudent && selectedDue && (
                <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-slate-400 pt-1">
                  <Info className="w-3.5 h-3.5 text-[#1d68ec]" />
                  <span>
                    Owes {formatCurrency(Number(amount) || selectedDue.amount)} for {selectedDue.name}
                  </span>
                </div>
              )}
            </div>

            {/* Row: Due & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Due</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedDueId}
                    onChange={(e) => handleDueChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec] cursor-pointer"
                  >
                    {dues.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-500 font-semibold text-sm">
                    ₦
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="2500"
                    className="w-full pl-8 pr-4 py-2.5 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec] font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Pills */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">
                How did they pay?
              </label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      paymentMethod === m.id
                        ? 'bg-[#1d68ec] text-white shadow-md shadow-[#1d68ec]/20'
                        : 'bg-surface-100 dark:bg-[#152033] text-surface-700 dark:text-slate-300 hover:bg-surface-200 dark:hover:bg-[#1a2842] border border-surface-200 dark:border-[#223352]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row: Receipt Ref & Date paid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">
                  Receipt or reference number
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. RC-0042"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">Date paid</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    value={datePaid}
                    onChange={(e) => setDatePaid(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Note (optional) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-surface-700 dark:text-slate-300">
                Note (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid in class after lecture"
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
              />
            </div>

            {/* File upload */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-surface-300 dark:border-[#223352] bg-surface-50/50 dark:bg-[#0b101c]/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="w-4 h-4 text-surface-400 shrink-0" />
                <span className="text-xs text-surface-600 dark:text-slate-400 truncate">
                  {receiptFileName || 'Attach a photo of the receipt (optional)'}
                </span>
              </div>
              <label className="px-3.5 py-1.5 rounded-lg bg-surface-200 dark:bg-[#1a2842] text-xs font-medium text-surface-700 dark:text-slate-200 hover:bg-surface-300 dark:hover:bg-[#223352] cursor-pointer transition-colors shrink-0">
                Browse
                <input type="file" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-5 py-2.5 rounded-xl border border-surface-300 dark:border-[#223352] text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white font-medium text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#1d68ec]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{submitting ? 'Recording...' : 'Record payment'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Receipt preview */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-6">
            <div>
              <p className="text-xs font-semibold text-surface-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                Receipt preview
              </p>
              <p className="text-3xl font-extrabold text-surface-900 dark:text-white mt-2">
                ₦{Number(amount || 0).toLocaleString()}
              </p>
            </div>

            <div className="divide-y divide-surface-100 dark:divide-surface-800/80 text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Student</span>
                <span className="font-semibold text-surface-900 dark:text-white text-right">
                  {selectedStudent?.fullName || selectedStudent?.firstName || 'Select student'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Due</span>
                <span className="font-semibold text-surface-900 dark:text-white text-right">
                  {selectedDue?.name || 'Select due'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Method</span>
                <span className="font-semibold text-surface-900 dark:text-white">{paymentMethod}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Recorded by</span>
                <span className="font-semibold text-surface-900 dark:text-white text-right">
                  {recordedByName} ({recordedByRole})
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-surface-500 dark:text-slate-400">Status</span>
                <span className="font-semibold text-amber-500">Needs HOD review</span>
              </div>
            </div>

            {/* Warning note */}
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Manual payments are saved in the audit log and sent to the department for review.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
