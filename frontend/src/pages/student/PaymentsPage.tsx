import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CreditCard,
  Download,
  ShoppingCart,
  Plus,
  Loader2,
  Receipt,
  Search,
  Check,
  AlertTriangle,
  Lock,
  X,
  Building2,
  PhoneCall,
  FileText,
  Clock,
  Share2,
  ChevronDown,
} from 'lucide-react';
import { formatNumber, formatDate } from '../../utils/formatters';
import {
  getStudentPayments,
  getStudentPaymentSummary,
  checkoutCart,
  getMyDues,
  addToCart,
  listStudentCart,
  removeFromCart,
  clearStudentCart,
  checkDuePaid,
  downloadPaymentReceipt,
  type CartItem,
} from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import type { Payment, DuePayment, PaymentStatus, PaymentType } from '../../types';

const STATUS_FILTERS: { key: PaymentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Successful' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
];

const TYPE_OPTIONS: { key: PaymentType | 'all'; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'dept_dues', label: 'Department Dues' },
  { key: 'class_dues', label: 'Class Dues' },
  { key: 'materials', label: 'Course Materials' },
  { key: 'transcript_fee', label: 'Transcript Fee' },
  { key: 'other', label: 'Other' },
];

const TYPE_LABELS: Record<string, string> = {
  dept_dues: 'Department Dues',
  class_dues: 'Class Dues',
  materials: 'Course Materials',
  transcript_fee: 'Transcript Fee',
  other: 'Other',
};

const PaymentsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [tab, setTab] = useState<'cart' | 'transactions'>('cart');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<{
    total_paid: number;
    total_pending: number;
    amount_paid: number;
    amount_pending: number;
  } | null>(null);
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartBusyId, setCartBusyId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paidDueIds, setPaidDueIds] = useState<Set<string>>(new Set());

  const [txSearch, setTxSearch] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<PaymentType | 'all'>('all');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCart = useCallback(async () => {
    if (!user?.id) return;
    try {
      const items = await listStudentCart(user.id);
      setCart(items || []);
    } catch {
      // ignore
    }
  }, [user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'transactions') setTab('transactions');

    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      getStudentPayments(user.id).catch(() => []),
      getStudentPaymentSummary(user.id).catch(() => null),
      getMyDues(user?.level).catch(() => []),
      listStudentCart(user.id).catch(() => []),
    ])
      .then(([pays, summ, duesData, cartData]) => {
        const sortedPays = (pays || []).sort(
          (a, b) =>
            new Date(b.created_at || b.createdAt || '').getTime() -
            new Date(a.created_at || a.createdAt || '').getTime(),
        );
        setPayments(sortedPays);
        if (sortedPays.length > 0) {
          setSelectedPaymentId(sortedPays[0].id);
        }
        setSummary(summ);
        setDues(duesData || []);
        setCart(cartData || []);

        (duesData || []).forEach((d: DuePayment) => {
          checkDuePaid(d.id, user!.id)
            .then((res) => {
              if (res.is_paid) setPaidDueIds((prev) => new Set(prev).add(d.id));
            })
            .catch(() => {});
        });
      })
      .catch(() => notifyError('Error', 'Failed to load payments'))
      .finally(() => setLoading(false));
  }, [user?.id, user?.level, notifyError]);

  const handleAddToCart = async (due: DuePayment) => {
    if (!user?.id) return;
    setCartBusyId(due.id);
    try {
      await addToCart(user.id, due.id, due.amount);
      await fetchCart();
      success('Added to Cart', `${due.name} added to your payment cart`);
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to add to cart'));
    } finally {
      setCartBusyId(null);
    }
  };

  const handleRemoveFromCart = async (cartItemId: string) => {
    setCartBusyId(cartItemId);
    try {
      await removeFromCart(cartItemId);
      setCart((prev) => prev.filter((c) => c.id !== cartItemId));
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to remove from cart'));
    } finally {
      setCartBusyId(null);
    }
  };

  const handleClearCart = async () => {
    if (!user?.id) return;
    try {
      await clearStudentCart(user.id);
      setCart([]);
      success('Cart Cleared', 'All dues removed from your cart');
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to clear cart'));
    }
  };

  const handleAddAllToCart = async () => {
    if (!user?.id) return;
    const duesToAdd = availableDues.filter((d) => !cartDueIds.has(d.id));
    if (duesToAdd.length === 0) return;

    setCartBusyId('all');
    try {
      for (const d of duesToAdd) {
        await addToCart(user.id, d.id, d.amount);
      }
      await fetchCart();
      success('Added to Cart', 'All dues added to your payment cart.');
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to add all dues to cart'));
    } finally {
      setCartBusyId(null);
    }
  };

  const handleCheckoutCart = async () => {
    try {
      if (!user?.email) {
        notifyError('Checkout Error', 'User email is required.');
        return;
      }
      setCheckoutLoading(true);
      const res = await checkoutCart();
      success('Redirecting', 'Forwarding to Paystack for dues payment...');
      if (res && res.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        notifyError('Checkout Error', 'No redirect URL returned.');
      }
    } catch (err) {
      notifyError('Checkout Error', getErrorMessage(err, 'Unable to initiate gateway transaction.'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    setReceiptBusyId(paymentId);
    try {
      await downloadPaymentReceipt(paymentId);
      success('Receipt Downloaded', 'Your official receipt PDF has been saved.');
    } catch (err) {
      notifyError('Download Failed', getErrorMessage(err, 'Could not download receipt'));
    } finally {
      setReceiptBusyId(null);
    }
  };

  const handleShareReceipt = async (p: Payment) => {
    const amountVal = Number(p.amount) || 0;
    const title = `Receipt: ${p.item_name || p.due_name || 'Dues'}`;
    const text = `ACES Payment Receipt\nItem: ${p.item_name || p.due_name || 'Dues'}\nAmount: ₦${formatNumber(amountVal)}\nReference: ${p.paystack_reference || 'N/A'}\nStatus: ${p.status}`;
    if (navigator.share && navigator.canShare && navigator.canShare({ title, text })) {
      try {
        await navigator.share({ title, text });
      } catch {
        // user dismissed share sheet
      }
    } else {
      await navigator.clipboard.writeText(text);
      success('Copied', 'Receipt details copied to clipboard.');
    }
  };

  const dueLookup = useMemo(() => new Map(dues.map((d) => [d.id, d])), [dues]);
  const cartDueIds = useMemo(() => new Set(cart.map((item) => item.due_id)), [cart]);

  // Available dues: active dues not yet paid by this student
  const availableDues = useMemo(() => {
    return dues.filter((d) => d.is_active && !paidDueIds.has(d.id));
  }, [dues, paidDueIds]);

  const outstandingBalance = useMemo(() => {
    if (summary && summary.amount_pending > 0) return summary.amount_pending;
    return availableDues.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [summary, availableDues]);

  const totalPaid = useMemo(() => {
    if (summary && summary.amount_paid !== undefined) return summary.amount_paid;
    return payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [summary, payments]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [cart]);

  // Filtered transactions
  const filteredPayments = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = txStatusFilter === 'all' || p.status === txStatusFilter;
      const matchesType = txTypeFilter === 'all' || p.type === txTypeFilter;
      const matchesSearch =
        !q ||
        (p.paystack_reference || '').toLowerCase().includes(q) ||
        (p.item_name || '').toLowerCase().includes(q) ||
        (p.due_name || '').toLowerCase().includes(q);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [payments, txSearch, txStatusFilter, txTypeFilter]);

  // Keep selected payment in view
  const selectedPayment = useMemo(() => {
    if (selectedPaymentId) {
      const found = filteredPayments.find((p) => p.id === selectedPaymentId);
      if (found) return found;
    }
    return filteredPayments.length > 0 ? filteredPayments[0] : null;
  }, [filteredPayments, selectedPaymentId]);

  const totalPaidInView = useMemo(() => {
    return filteredPayments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const completedCountInView = useMemo(() => {
    return filteredPayments.filter((p) => p.status === 'completed').length;
  }, [filteredPayments]);

  return (
    <div className="flex flex-col min-h-0 text-[var(--text)] space-y-6 pb-12">
      {/* ======================================================== */}
      {/* TOP HEADER                                               */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">Payments & Dues</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Pay your department dues and class fees securely via Paystack.
          </p>
        </div>

        {/* Top Segmented Pills (Dues & cart, Transactions) */}
        <div className="inline-flex p-1 rounded-full border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#13151b] shadow-sm select-none gap-1 self-start sm:self-auto">
          <button
            onClick={() => setTab('cart')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              tab === 'cart' ? 'bg-[#1d68ec] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Dues & cart</span>
          </button>

          <button
            onClick={() => setTab('transactions')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              tab === 'transactions'
                ? 'bg-[#1d68ec] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Transactions</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec]" />
          <p className="text-xs text-[var(--text-muted)]">Loading payments and dues...</p>
        </div>
      ) : tab === 'transactions' ? (
        /* ======================================================== */
        /* TRANSACTIONS VIEW (Matches Screenshots 2, 3, 4, 5)       */
        /* ======================================================== */
        <div className="space-y-6">
          {/* 1. TOP 3 STAT SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            {/* Showing */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-medium truncate">Showing</p>
                <p className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text)] truncate mt-0.5">
                  {filteredPayments.length}
                </p>
              </div>
            </div>

            {/* Completed */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-medium truncate">Completed</p>
                <p className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                  {completedCountInView}
                </p>
              </div>
            </div>

            {/* Total Paid in View */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-medium truncate">Total paid (in view)</p>
                <p className="text-xl sm:text-2xl font-black tracking-tight text-[#1d68ec] truncate mt-0.5">
                  ₦{formatNumber(totalPaidInView)}
                </p>
              </div>
            </div>
          </div>

          {/* 2. SEARCH & FILTER PILLS ROW */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search reference or purpose"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 text-xs sm:text-sm rounded-full border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#1d68ec] transition-colors"
              />
              {txSearch && (
                <button
                  onClick={() => setTxSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTxStatusFilter(f.key)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    txStatusFilter === f.key
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-slate-300 dark:hover:border-[#383d4e]'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Custom Type Dropdown Pill */}
              <div className="relative shrink-0" ref={typeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setTypeDropdownOpen((prev) => !prev)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                    txTypeFilter !== 'all'
                      ? 'border-[#1d68ec] text-[#1d68ec] bg-blue-50/50 dark:bg-blue-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-slate-300 dark:hover:border-[#383d4e]'
                  }`}
                >
                  <span>{TYPE_OPTIONS.find((t) => t.key === txTypeFilter)?.label || 'All types'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-150 ${
                      typeDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {typeDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                    {TYPE_OPTIONS.map((t) => {
                      const isSelected = txTypeFilter === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => {
                            setTxTypeFilter(t.key);
                            setTypeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 text-[#1d68ec]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-50 dark:hover:bg-[#1f222d]'
                          }`}
                        >
                          <span>{t.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#1d68ec]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. MAIN TRANSACTIONS CONTENT */}
          {filteredPayments.length === 0 ? (
            /* EMPTY TRANSACTIONS STATE (Screenshots 2 & 4) */
            <div className="rounded-3xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] py-24 px-6 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center mx-auto">
                <Receipt className="w-8 h-8 stroke-[1.8]" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--text)]">No transactions yet</h3>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 max-w-sm mx-auto leading-relaxed">
                  Your payment history and receipts will appear here once you make a payment.
                </p>
              </div>
              <button
                onClick={() => setTab('cart')}
                className="px-5 py-2.5 rounded-full bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Go to dues</span>
              </button>
            </div>
          ) : (
            /* POPULATED 2-COLUMN LAYOUT (Screenshots 3 & 5) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: TRANSACTIONS LOG TABLE (~8 cols) */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm overflow-hidden space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text)]">Transactions log</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Search and filter your payment records</p>
                </div>

                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-[#20232e] text-[11px] font-bold text-[var(--text-muted)] tracking-wider">
                        <th className="py-3 px-3">REFERENCE</th>
                        <th className="py-3 px-3">PURPOSE</th>
                        <th className="py-3 px-3">DATE</th>
                        <th className="py-3 px-3">AMOUNT</th>
                        <th className="py-3 px-3">STATUS</th>
                        <th className="py-3 px-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#20232e]">
                      {filteredPayments.map((p) => {
                        const isSelected = selectedPayment?.id === p.id;
                        const isCompleted = p.status === 'completed';
                        const isPending = p.status === 'pending';

                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPaymentId(p.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-[#1d68ec]'
                                : 'hover:bg-slate-50/70 dark:hover:bg-[#13151b] border-l-4 border-l-transparent'
                            }`}
                          >
                            <td className="py-3.5 px-3 font-mono text-xs break-all tracking-wide font-bold text-[var(--text)]">
                              {p.paystack_reference || 'N/A'}
                            </td>

                            <td className="py-3.5 px-3 font-bold text-[var(--text)]">
                              {p.item_name || p.due_name || TYPE_LABELS[p.type] || 'Departmental dues'}
                            </td>

                            <td className="py-3.5 px-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                              {formatDate(p.created_at || p.createdAt, 'd MMM yyyy')}
                            </td>
                            <td className="py-3.5 px-3 font-extrabold text-[var(--text)] whitespace-nowrap">
                              ₦{formatNumber(Number(p.amount) || 0)}
                            </td>

                            <td className="py-3.5 px-3 whitespace-nowrap">
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Successful</span>
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/30 text-amber-500 bg-amber-500/5">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Pending</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 text-red-500 bg-red-500/5">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Failed</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-right whitespace-nowrap">
                              {isCompleted && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadReceipt(p.id);
                                  }}
                                  disabled={receiptBusyId === p.id}
                                  className="p-2 rounded-xl border border-slate-200 dark:border-[#2b2e3c] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1f222d] transition-colors"
                                  title="Download receipt"
                                >
                                  {receiptBusyId === p.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT COLUMN: RECEIPT PREVIEW SIDE-PANEL (~4 cols) */}
              {selectedPayment && (
                <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-6">
                  {/* Top Header of Receipt Box */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20232e]">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--text)]">Receipt</h3>
                    {selectedPayment.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Successful</span>
                      </span>
                    ) : selectedPayment.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-amber-500/30 text-amber-500 bg-amber-500/5">
                        <Clock className="w-3 h-3" />
                        <span>Pending</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border border-red-500/30 text-red-500 bg-red-500/5">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                  </div>

                  {/* Big Amount Paid */}
                  <div className="text-center py-2">
                    <p className="text-xs text-[var(--text-muted)] font-medium">Amount paid</p>
                    <p className="text-3xl sm:text-4xl font-black text-[var(--text)] tracking-tight mt-1">
                      ₦{formatNumber(Number(selectedPayment.amount) || 0)}
                    </p>
                  </div>

                  {/* Receipt Details Card */}
                  <div className="rounded-2xl border border-slate-200 dark:border-[#222530] bg-slate-50/50 dark:bg-[#12141a] p-4 text-xs divide-y divide-slate-100 dark:divide-[#20232e] space-y-2.5">
                    <div className="flex items-center justify-between pb-2">
                      <span className="text-[var(--text-muted)] pr-2 font-medium">Reference</span>
                      <span className="font-mono font-bold text-[var(--text)] tracking-wider">
                        {selectedPayment.paystack_reference || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 pb-2">
                      <span className="text-[var(--text-muted)] font-medium">Purpose</span>
                      <span className="font-bold text-[var(--text)] text-right truncate ml-2">
                        {selectedPayment.item_name ||
                          selectedPayment.due_name ||
                          TYPE_LABELS[selectedPayment.type] ||
                          'Departmental dues'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 pb-2">
                      <span className="text-[var(--text-muted)] font-medium">Date</span>
                      <span className="font-medium text-[var(--text)]">
                        {formatDate(selectedPayment.created_at || selectedPayment.createdAt, 'd MMM yyyy')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 pb-2">
                      <span className="text-[var(--text-muted)] font-medium">Method</span>
                      <span className="font-medium text-[var(--text)]">Paystack &middot; Card</span>
                    </div>

                    <div className="flex items-center justify-between pt-2.5">
                      <span className="text-[var(--text-muted)] font-medium">Student</span>
                      <span className="font-bold text-[var(--text)] truncate ml-2">{user?.full_name || 'Student'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2.5 pt-1">
                    {selectedPayment.status === 'completed' && (
                      <button
                        onClick={() => handleDownloadReceipt(selectedPayment.id)}
                        disabled={receiptBusyId === selectedPayment.id}
                        className="w-full py-3 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                      >
                        {receiptBusyId === selectedPayment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>Download receipt</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleShareReceipt(selectedPayment)}
                      className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-[#2a2e3c] hover:bg-slate-50 dark:hover:bg-[#1c1f28] text-[var(--text)] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* DUES & CART VIEW (Matches Screenshots 1, 3, 4, 5)       */
        /* ======================================================== */
        <div className="space-y-6">
          {/* 1. BLUE HERO BANNER */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#3b82f6] to-[#1d68ec] text-white p-6 sm:p-8 shadow-sm">
            {/* Background concentric decorative curves */}
            <div className="absolute right-0 top-0 bottom-0 w-2/3 pointer-events-none overflow-hidden select-none">
              <svg
                className="absolute -right-16 -top-16 w-[420px] h-[420px] opacity-20 text-white"
                viewBox="0 0 200 200"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="160" cy="40" r="45" strokeWidth="1" />
                <circle cx="160" cy="40" r="80" strokeWidth="1" />
                <circle cx="160" cy="40" r="120" strokeWidth="1" />
                <circle cx="160" cy="40" r="160" strokeWidth="1" />
              </svg>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <div className="flex items-center gap-1.5 text-blue-100 text-xs sm:text-sm font-medium">
                  {outstandingBalance === 0 && <Check className="w-4 h-4 text-white" />}
                  <span>Outstanding balance</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tight mt-1">
                  ₦{formatNumber(outstandingBalance)}
                </h2>
                <p className="text-xs sm:text-sm text-blue-100 mt-2">
                  {outstandingBalance === 0
                    ? 'You are all paid up. New dues will appear here.'
                    : `${availableDues.length} ${availableDues.length === 1 ? 'due' : 'dues'} available this semester`}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                {outstandingBalance === 0 ? (
                  <div className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[#0c0d12] text-white flex items-center gap-2 shadow-md">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>No payment needed</span>
                  </div>
                ) : (
                  <button
                    onClick={handleAddAllToCart}
                    disabled={cartBusyId === 'all'}
                    className="px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[#0c0d12] hover:bg-black text-white flex items-center gap-2 shadow-md transition-all active:scale-95"
                  >
                    {cartBusyId === 'all' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Pay all dues</span>
                        <span>&gt;</span>
                      </>
                    )}
                  </button>
                )}
                <div className="flex items-center gap-1.5 text-[11px] text-blue-100">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Secured by Paystack</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. 4 STAT SUMMARY CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Paid */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-medium truncate">Total paid</p>
                <p className="text-lg sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                  ₦{formatNumber(totalPaid)}
                </p>
              </div>
            </div>

            {/* Outstanding */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-medium truncate">Outstanding</p>
                <p className="text-lg sm:text-2xl font-black tracking-tight text-[var(--text)] truncate mt-0.5">
                  ₦{formatNumber(outstandingBalance)}
                </p>
              </div>
            </div>

            {/* Cart Items */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-medium truncate">Cart items</p>
                <p className="text-lg sm:text-2xl font-black tracking-tight text-[var(--text)] truncate mt-0.5">
                  {cart.length}
                </p>
              </div>
            </div>

            {/* Cart Total */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--text-muted)] font-medium truncate">Cart total</p>
                <p className="text-lg sm:text-2xl font-black tracking-tight text-[#1d68ec] truncate mt-0.5">
                  ₦{formatNumber(cartTotal)}
                </p>
              </div>
            </div>
          </div>

          {/* 3. MAIN BODY: 2-COLUMN LAYOUT (AVAILABLE DUES + YOUR CART) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: AVAILABLE DUES (~8 cols) */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20232e]">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text)]">Available dues</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Add what you want to pay now</p>
                </div>
                {availableDues.length > 0 && (
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    {availableDues.length} {availableDues.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>

              {availableDues.length === 0 ? (
                /* EMPTY STATE (Screenshots 1 & 4) */
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-bold text-[var(--text)]">Nothing due right now</h4>
                  <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
                    When the department adds dues or class fees, they will show up here for you to pay.
                  </p>
                </div>
              ) : (
                /* DUES LIST (Screenshots 3 & 5) */
                <div className="space-y-3 pt-1">
                  {availableDues.map((due) => {
                    const isInCart = cartDueIds.has(due.id);
                    const cartItem = cart.find((c) => c.due_id === due.id);
                    const isRequired =
                      due.type === 'dept_dues' ||
                      due.type === 'class_dues' ||
                      !due.description?.toLowerCase().includes('optional');

                    return (
                      <div
                        key={due.id}
                        className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                          isInCart
                            ? 'border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/10'
                            : 'border-slate-200/80 dark:border-[#222530] bg-slate-50/40 dark:bg-[#12141a] hover:border-slate-300 dark:hover:border-[#2c303f]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isInCart}
                            onChange={() => {
                              if (isInCart && cartItem) {
                                handleRemoveFromCart(cartItem.id);
                              } else {
                                handleAddToCart(due);
                              }
                            }}
                            className="w-4 h-4 rounded text-[#1d68ec] focus:ring-[#1d68ec] border-slate-300 dark:border-[#2b2e3c] cursor-pointer"
                          />
                          <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#191b24] border border-slate-200/60 dark:border-[#262936] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">{due.name}</h4>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isRequired
                                    ? 'bg-blue-500/10 text-[#1d68ec]'
                                    : 'bg-slate-200/70 dark:bg-[#252833] text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {isRequired ? 'Required' : 'Optional'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                              {due.description ||
                                (due.type === 'dept_dues'
                                  ? 'Annual contribution to the department'
                                  : 'Handouts and class activities')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm sm:text-base font-extrabold text-[var(--text)]">
                            ₦{formatNumber(Number(due.amount) || 0)}
                          </span>
                          {isInCart && cartItem ? (
                            <button
                              onClick={() => handleRemoveFromCart(cartItem.id)}
                              disabled={cartBusyId === cartItem.id}
                              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors"
                            >
                              {cartBusyId === cartItem.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>In cart</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(due)}
                              disabled={cartBusyId === due.id}
                              className="px-4 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-[#2d3140] text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1d202a] flex items-center gap-1.5 transition-colors"
                            >
                              {cartBusyId === due.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: YOUR CART (~4 cols) */}
            <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20232e]">
                <h3 className="text-sm sm:text-base font-bold text-[var(--text)]">Your cart ({cart.length})</h3>
                {cart.length > 0 && (
                  <button onClick={handleClearCart} className="text-xs font-semibold text-[#1d68ec] hover:underline">
                    Clear
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                /* EMPTY CART STATE (Screenshots 1 & 4) */
                <div className="space-y-4">
                  <div className="p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-[#222530] bg-slate-50/40 dark:bg-[#12141a]">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center mx-auto mb-3">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-[var(--text)]">Your cart is empty</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Add dues from the list to pay.</p>
                  </div>

                  <button
                    disabled
                    className="w-full py-3 rounded-full bg-slate-200/80 dark:bg-[#202430] text-slate-400 dark:text-slate-500 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Pay with Paystack</span>
                  </button>
                </div>
              ) : (
                /* FILLED CART STATE (Screenshots 3 & 5) */
                <div className="space-y-4">
                  <div className="space-y-3 divide-y divide-slate-100 dark:divide-[#20232e]">
                    {cart.map((item) => {
                      const due = dueLookup.get(item.due_id);
                      const isRequired =
                        due?.type === 'dept_dues' ||
                        due?.type === 'class_dues' ||
                        !due?.description?.toLowerCase().includes('optional');

                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 pt-3 first:pt-0">
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">
                              {due?.name || 'Due'}
                            </h4>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {isRequired ? 'Required' : 'Optional'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-xs sm:text-sm font-bold text-[var(--text)]">
                              ₦{formatNumber(Number(item.amount) || 0)}
                            </span>
                            <button
                              onClick={() => handleRemoveFromCart(item.id)}
                              disabled={cartBusyId === item.id}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                              title="Remove item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 dark:border-[#20232e] pt-4 flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-[var(--text-muted)]">Total</span>
                    <span className="text-xl sm:text-2xl font-black text-[var(--text)]">
                      ₦{formatNumber(cartTotal)}
                    </span>
                  </div>

                  <button
                    onClick={handleCheckoutCart}
                    disabled={checkoutLoading}
                    className="w-full py-3 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
                  >
                    {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>Pay ₦{formatNumber(cartTotal)} with Paystack</span>
                  </button>

                  <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--text-muted)] pt-1">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> Card
                    </span>
                    <span>&middot;</span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> Transfer
                    </span>
                    <span>&middot;</span>
                    <span className="flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5" /> USSD
                    </span>
                  </div>

                  <p className="text-[10px] text-[var(--text-muted)] text-center leading-relaxed">
                    Payments are processed by Paystack. Your card details are never stored by the department.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;
