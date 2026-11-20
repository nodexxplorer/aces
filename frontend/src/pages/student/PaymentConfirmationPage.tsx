import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Check, CreditCard, Download, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { confirmMyPaymentByReference, downloadPaymentReceipt, getMyDues, checkDuePaid } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { formatNumber } from '../../utils/formatters';
import type { Payment, DuePayment } from '../../types';

const PaymentConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [allDues, setAllDues] = useState<DuePayment[]>([]);
  const [paidDueIds, setPaidDueIds] = useState<Set<string>>(new Set());

  const firstName = useMemo(() => {
    if (user?.full_name) return user.full_name.split(' ')[0];
    return 'Student';
  }, [user?.full_name]);

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      return;
    }

    let cancelled = false;
    let attempt = 0;
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds between retries

    const verify = async () => {
      try {
        const data = await confirmMyPaymentByReference(reference);
        if (cancelled) return;
        setPayment(data);
        if (data?.status === 'completed') {
          setStatus('success');
        } else if (data?.status === 'pending') {
          // Payment exists but isn't completed yet. The webhook or a
          // subsequent call may still complete it — retry a few times
          // with a delay before giving up.
          attempt++;
          if (attempt < maxRetries) {
            setStatus('loading');
            setTimeout(() => {
              if (!cancelled) void verify();
            }, retryDelay);
          } else {
            setStatus('pending');
          }
        } else {
          setStatus('error');
        }
      } catch {
        if (cancelled) return;
        // Network / server error. Retry a couple of times before
        // showing an error — the webhook may still complete the payment.
        attempt++;
        if (attempt < maxRetries) {
          setStatus('loading');
          setTimeout(() => {
            if (!cancelled) void verify();
          }, retryDelay);
        } else {
          setStatus('error');
        }
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  useEffect(() => {
    if (!user?.id) return;
    getMyDues(user?.level)
      .then((dues) => {
        setAllDues(dues || []);
        dues.forEach((d: DuePayment) => {
          checkDuePaid(d.id, user!.id)
            .then((res) => {
              if (res.is_paid) setPaidDueIds((prev) => new Set(prev).add(d.id));
            })
            .catch(() => {});
        });
      })
      .catch(() => {});
  }, [user?.id, user?.level]);

  const remainingBalance = useMemo(() => {
    return allDues
      .filter((d) => d.is_active && !paidDueIds.has(d.id) && d.id !== payment?.due_id)
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [allDues, paidDueIds, payment?.due_id]);

  const handleDownload = async () => {
    if (!payment?.id) return;
    setDownloading(true);
    try {
      await downloadPaymentReceipt(payment.id, payment.item_name || payment.due_name || 'Dues Receipt');
      success('Receipt Downloaded', 'Your payment receipt has been saved.');
    } catch {
      notifyError('Download Failed', 'Could not download receipt PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const amountNumber = Number(payment?.amount) || 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4 text-[var(--text)]">
      {status === 'loading' ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#1d68ec]" />
          <h2 className="text-base font-bold text-[var(--text)]">Verifying your payment...</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Please wait while we confirm your transaction with Paystack.
          </p>
        </div>
      ) : status === 'error' ? (
        <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-8 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text)]">Payment Verification Issue</h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            We could not verify this transaction reference ({reference || 'N/A'}). If you were debited, please check
            your transactions or contact support.
          </p>
          <div className="pt-2">
            <Link
              to="/i/payments"
              className="w-full py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Payments
            </Link>
          </div>
        </div>
      ) : status === 'pending' ? (
        <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-8 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text)]">Payment Processing</h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Your payment for reference <span className="font-mono font-semibold">{reference}</span> is still being
            processed. This usually completes within a few seconds.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setStatus('loading');
                window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Loader2 className="w-4 h-4" /> Refresh &amp; Retry
            </button>
            <Link
              to="/i/payments"
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[#2b2f3d] text-[var(--text)] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Check Transactions
            </Link>
          </div>
        </div>
      ) : (
        /* SUCCESS SCREEN (Matches Screenshot 2) */
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-8 sm:p-10 text-center shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Concentric Circle Green Success Badge */}
          <div className="w-24 h-24 rounded-full border-4 border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center justify-center mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Check className="w-9 h-9 stroke-[3]" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text)] tracking-tight">Payment successful</h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1.5">
              Thank you, {firstName}. Your receipt has also been sent to Communication.
            </p>
          </div>

          {/* Amount in Huge Bold Typography */}
          <div className="py-2">
            <span className="text-4xl sm:text-5xl font-black text-[var(--text)] tracking-tight">
              ₦{formatNumber(amountNumber)}
            </span>
          </div>

          {/* Receipt Breakdown Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-[#222530] bg-slate-50/50 dark:bg-[#12141a] p-5 text-xs divide-y divide-slate-100 dark:divide-[#20232e] text-left space-y-2.5">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[var(--text-muted)] font-medium">
                {payment?.item_name || payment?.due_name || 'Departmental dues'}
              </span>
              <span className="font-bold text-[var(--text)]">₦{formatNumber(amountNumber)}</span>
            </div>

            <div className="flex items-center justify-between pt-2.5 pb-2">
              <span className="text-[var(--text-muted)] font-medium">Reference</span>
              <span className="font-mono font-bold text-[var(--text)] tracking-wider">
                {reference || payment?.paystack_reference || 'PSK-9C41D2'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5">
              <span className="text-[var(--text-muted)] font-medium">Method</span>
              <span className="font-medium text-[var(--text)]">Paystack &middot; Card</span>
            </div>
          </div>

          {/* Remaining Balance Pill (if any dues left) */}
          {remainingBalance > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] flex items-center justify-between text-xs shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <span className="text-[11px] text-[var(--text-muted)] block">Remaining balance</span>
                  <span className="font-bold text-[var(--text)]">₦{formatNumber(remainingBalance)}</span>
                </div>
              </div>
              <Link to="/i/payments" className="text-[#1d68ec] hover:underline font-bold text-xs shrink-0">
                Optional dues &rarr;
              </Link>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="py-3 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Download receipt</span>
            </button>

            <Link
              to="/student/dashboard"
              className="py-3 px-4 rounded-xl border border-slate-200 dark:border-[#2b2f3d] bg-white dark:bg-[#15171e] hover:bg-slate-50 dark:hover:bg-[#1d2028] text-[var(--text)] text-xs sm:text-sm font-bold flex items-center justify-center transition-all shadow-sm"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentConfirmationPage;
