import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getPaymentByReference, getRecentVerifiedPayments, verifyPayment } from '../../api/payments';
import { Search, Check, RefreshCw, PenLine } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errors';
import type { Payment } from '../../types';

export default function PaymentVerificationPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [refInput, setRefInput] = useState('');
  const [searchedRecord, setSearchedRecord] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [recentVerifications, setRecentVerifications] = useState<Payment[]>([]);

  const fetchRecent = async () => {
    try {
      const verified = await getRecentVerifiedPayments();
      setRecentVerifications(Array.isArray(verified) ? verified : []);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const handleSearch = async () => {
    if (!refInput.trim()) return;
    try {
      setLoading(true);
      const payment = await getPaymentByReference(refInput.trim());
      setSearchedRecord(payment);
      success('Record Found', `Payment found for ${payment.student_name}`);
    } catch {
      notifyError('Not Found', `No payment found for reference "${refInput}".`);
      setSearchedRecord(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveManually = async () => {
    if (!searchedRecord || !user?.id) return;
    try {
      setVerifying(true);
      const updated = await verifyPayment(searchedRecord.id);
      setSearchedRecord(updated);
      setRecentVerifications((prev) => [updated, ...prev.filter((p) => p.id !== updated.id)]);
      success('Manually Approved', `Payment ${searchedRecord.paystack_reference || searchedRecord.id} verified.`);
    } catch (err) {
      notifyError('Approval Failed', getErrorMessage(err, 'Could not verify payment'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-surface-400 dark:text-slate-400 uppercase tracking-wider mb-1">
          Dues &amp; Payments
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-surface-900 dark:text-white">Verify payments</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Search by Paystack reference, confirm transactions and approve manually if needed.
        </p>
      </div>

      {/* Top Tabs */}
      <div className="flex items-center gap-2">
        <Link
          to="/bu/dues"
          className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] text-surface-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors"
        >
          Dues
        </Link>
        <Link
          to="/bu/history"
          className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] text-surface-700 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-[#152033] transition-colors"
        >
          Transactions
        </Link>
        <div className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1d68ec] text-white flex items-center gap-1.5 shadow-sm">
          <Check className="w-3.5 h-3.5" />
          <span>Verify</span>
        </div>
      </div>

      {/* 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Reference audit */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-[#152033] flex items-center justify-center text-[#1d68ec] shrink-0">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-900 dark:text-white">Reference audit</h2>
              <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5">
                Paste a Paystack reference to check a payment
              </p>
            </div>
          </div>

          {/* Search Input & Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. ACES-abc12345-1234567890"
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-300 dark:border-[#1e2a3f] text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1d68ec]"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || !refInput.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{loading ? 'Checking...' : 'Check'}</span>
            </button>
          </div>

          {/* Checklist bullets matching PDF page 5 */}
          <div className="space-y-2 pt-2 border-t border-surface-100 dark:border-surface-800/80 text-xs text-surface-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Find a payment a student says they made.</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>See if the gateway confirmed it.</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Approve it by hand only with a reason.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Recent verifications */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm">
          <h2 className="text-base font-bold text-surface-900 dark:text-white">Recent verifications</h2>
          <p className="text-xs text-surface-400 dark:text-slate-400 mt-0.5 mb-4">Payments you checked lately</p>

          {recentVerifications.length === 0 ? (
            <div className="py-10 text-center text-xs text-surface-400 dark:text-slate-500">
              No recent verifications
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-800 text-surface-400 dark:text-slate-400 uppercase text-[10px] text-left">
                    <th className="py-2.5 px-2 font-semibold">Reference</th>
                    <th className="py-2.5 px-2 font-semibold">Student</th>
                    <th className="py-2.5 px-2 font-semibold">Purpose</th>
                    <th className="py-2.5 px-2 font-semibold">Amount</th>
                    <th className="py-2.5 px-2 font-semibold">Status</th>
                    <th className="py-2.5 px-2 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800/60">
                  {recentVerifications.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-[#152033]/40">
                      <td className="py-2.5 px-2 font-mono text-[11px] text-surface-700 dark:text-slate-300 truncate max-w-[120px]">
                        {p.paystack_reference || p.id.slice(0, 12)}
                      </td>
                      <td className="py-2.5 px-2 font-medium text-surface-900 dark:text-white">{p.student_name}</td>
                      <td className="py-2.5 px-2 text-surface-600 dark:text-slate-400 truncate max-w-[130px]">
                        {p.item_name || 'Dues'}
                      </td>
                      <td className="py-2.5 px-2 font-semibold text-surface-900 dark:text-white">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3 h-3" />
                          Successful
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-surface-400">
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

      {/* Bottom Result Card (Shows when search is made) */}
      {searchedRecord && (
        <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-[#111927] p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-surface-900 dark:text-white">Result</h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                searchedRecord.status === 'completed' || searchedRecord.status === 'success'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              {searchedRecord.status === 'completed' || searchedRecord.status === 'success' ? 'Verified' : 'Pending'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-50 dark:bg-[#0b101c] border border-surface-200 dark:border-[#1a2538] text-xs">
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Reference</p>
              <p className="font-mono font-medium text-surface-900 dark:text-white mt-1 truncate">
                {searchedRecord.paystack_reference || searchedRecord.id}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Student</p>
              <p className="font-medium text-surface-900 dark:text-white mt-1">{searchedRecord.student_name}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Amount</p>
              <p className="font-bold text-surface-900 dark:text-white mt-1">{formatCurrency(searchedRecord.amount)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Gateway</p>
              <p className="font-medium text-surface-900 dark:text-white mt-1">
                {searchedRecord.status === 'completed' || searchedRecord.status === 'success'
                  ? 'Confirmed'
                  : 'Not confirmed yet'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-xs text-surface-400 dark:text-slate-500">
              Manual approval needs a reason and is saved in the audit log.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-surface-300 dark:border-[#223352] text-surface-700 dark:text-slate-300 hover:bg-surface-100 dark:hover:bg-[#152033] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Re-check with Paystack</span>
              </button>
              <button
                onClick={handleApproveManually}
                disabled={verifying}
                className="px-4 py-2 rounded-xl bg-[#1d68ec] hover:bg-[#1a5cd1] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>{verifying ? 'Approving...' : 'Approve manually'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
