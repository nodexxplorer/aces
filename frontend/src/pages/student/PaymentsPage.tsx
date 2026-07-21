import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/data-display/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getStudentPayments, getStudentPaymentSummary, initializeCheckout, getMyDues, addToCart, listStudentCart, removeFromCart, clearStudentCart, checkDuePaid } from '../../api/payments';
import type { CartItem } from '../../api/payments';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { CreditCard, Download, ShoppingCart, Trash2, Plus, Loader2, Receipt } from 'lucide-react';
import type { Payment, DuePayment } from '../../types';

const PaymentsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [tab, setTab] = useState<'transactions' | 'cart'>('transactions');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<{ total_paid: number; total_pending: number; amount_paid: number; amount_pending: number } | null>(null);
  const [dues, setDues] = useState<DuePayment[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartBusyId, setCartBusyId] = useState<string | null>(null);
  const [paidDueIds, setPaidDueIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      getStudentPayments(user.id),
      getStudentPaymentSummary(user.id).catch(() => null),
      getMyDues((user as any)?.level).catch(() => []),
    ])
      .then(([pays, summ, duesData]) => {
        setPayments(pays);
        setSummary(summ);
        setDues(duesData);
        duesData.forEach((d: DuePayment) => {
          checkDuePaid(d.id, user!.id)
            .then((res) => {
              if (res.is_paid) setPaidDueIds((prev) => new Set(prev).add(d.id));
            })
            .catch(() => {});
        });
      })
      .catch(() => notifyError('Error', 'Failed to load payments'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const fetchCart = async () => {
    if (!user?.id) return;
    setCartLoading(true);
    try {
      const items = await listStudentCart(user.id);
      setCart(items);
    } catch {
      notifyError('Error', 'Failed to load cart');
    } finally {
      setCartLoading(false);
    }
  };

  const handleAddToCart = async (due: DuePayment) => {
    if (!user?.id) return;
    setCartBusyId(due.id);
    try {
      await addToCart(user.id, due.id, due.amount);
      success('Added to Cart', `${due.name} added to your payment cart`);
      fetchCart();
    } catch {
      notifyError('Error', 'Failed to add to cart');
    } finally {
      setCartBusyId(null);
    }
  };

  const handleRemoveFromCart = async (cartItemId: string) => {
    setCartBusyId(cartItemId);
    try {
      await removeFromCart(cartItemId);
      setCart((prev) => prev.filter((c) => c.id !== cartItemId));
    } catch {
      notifyError('Error', 'Failed to remove from cart');
    } finally {
      setCartBusyId(null);
    }
  };

  const handleClearCart = async () => {
    if (!user?.id) return;
    try {
      await clearStudentCart(user.id);
      setCart([]);
      success('Cart Cleared', 'All items removed from your cart');
    } catch {
      notifyError('Error', 'Failed to clear cart');
    }
  };

  const handleCheckout = async (paymentId: string, purpose: string) => {
    try {
      if (!user?.email) {
        notifyError('Checkout Error', 'User email is required.');
        return;
      }
      const res = await initializeCheckout(paymentId, user.email);
      success('Redirecting', `Forwarding to Paystack for ${purpose}...`);
      if (res && res.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        notifyError('Checkout Error', 'No redirect URL returned.');
      }
    } catch {
      notifyError('Checkout Error', 'Unable to initiate gateway transaction.');
    }
  };

  const dueLookup = new Map(dues.map((d) => [d.id, d]));
  const cartTotal = cart.reduce((sum, item) => sum + Number(item.amount), 0);

  const tabs = [
    { key: 'transactions' as const, label: 'Transactions', icon: Receipt },
    { key: 'cart' as const, label: `Cart (${cart.length})`, icon: ShoppingCart },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Payments & Dues</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Pay your department dues and class fees securely via Paystack gateway.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Total Paid</p>
          <p className="text-xl font-bold text-success-600 dark:text-success-400 mt-1">{formatCurrency(summary?.amount_paid ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Outstanding</p>
          <p className="text-xl font-bold text-warning-600 dark:text-warning-400 mt-1">{formatCurrency(summary?.amount_pending ?? 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Cart Items</p>
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400 mt-1">{cart.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Cart Total</p>
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400 mt-1">{formatCurrency(cartTotal)}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 p-1 rounded-lg">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === 'cart') fetchCart(); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-surface-900 text-primary-600 shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading payments...</span>
        </div>
      ) : tab === 'transactions' ? (
        <Card>
          <CardHeader>
            <CardTitle>Transactions Log</CardTitle>
            <CardDescription>Records of all dues payments and transaction audits</CardDescription>
          </CardHeader>
          {payments.length === 0 ? (
            <div className="text-center py-12 text-sm text-surface-400">No transactions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">PURPOSE</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">AMOUNT</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">REFERENCE</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">DATE</th>
                    <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">STATUS</th>
                    <th className="text-right px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{p.item_name}</td>
                      <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-surface-500">{p.paystack_reference || 'N/A'}</td>
                      <td className="px-4 py-3 text-xs text-surface-500">{formatDate(p.createdAt || '')}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {p.status === 'completed' ? (
                          <Button variant="outline" size="xs" leftIcon={<Download className="w-3.5 h-3.5" />}>Receipt</Button>
                        ) : (
                          <Button size="xs" leftIcon={<CreditCard className="w-3.5 h-3.5" />} onClick={() => handleCheckout(p.id, p.item_name)}>
                            Pay Now
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        /* Cart Tab */
        <div className="space-y-6">
          {/* Available Dues to Add */}
          {dues.filter((d) => d.is_active && !paidDueIds.has(d.id)).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Add Dues to Cart</CardTitle>
                <CardDescription>Select dues to pay in bulk</CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">DUE NAME</th>
                      <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">AMOUNT</th>
                      <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">LEVEL</th>
                      <th className="text-right px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dues.filter((d) => d.is_active && !paidDueIds.has(d.id)).map((due) => (
                      <tr key={due.id} className="border-b border-surface-100 dark:border-surface-800">
                        <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{due.name}</td>
                        <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{formatCurrency(due.amount)}</td>
                        <td className="px-4 py-3 text-xs text-surface-500">{due.level ? `${due.level * 100} Level` : 'All'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="xs" variant="outline" leftIcon={cartBusyId === due.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} onClick={() => handleAddToCart(due)} disabled={cartBusyId === due.id}>
                            Add
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Cart Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Your Cart</CardTitle>
                  <CardDescription>Review and checkout your selected dues</CardDescription>
                </div>
                {cart.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleClearCart} leftIcon={<Trash2 className="w-4 h-4" />}>
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            {cartLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              </div>
            ) : cart.length === 0 ? (
              <div className="text-center py-12 text-sm text-surface-400">
                Your cart is empty. Add dues from the list above.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 dark:border-surface-700">
                        <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">DUE</th>
                        <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">AMOUNT</th>
                        <th className="text-left px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ADDED</th>
                        <th className="text-right px-4 py-3 font-semibold text-surface-600 dark:text-surface-300">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => {
                        const due = dueLookup.get(item.due_id);
                        return (
                          <tr key={item.id} className="border-b border-surface-100 dark:border-surface-800">
                            <td className="px-4 py-3 font-medium text-surface-900 dark:text-white">{due?.name || 'Unknown Due'}</td>
                            <td className="px-4 py-3 text-surface-700 dark:text-surface-300">{formatCurrency(Number(item.amount))}</td>
                            <td className="px-4 py-3 text-xs text-surface-500">{item.added_at ? new Date(item.added_at).toLocaleDateString() : ''}</td>
                            <td className="px-4 py-3 text-right">
                              <Button size="xs" variant="danger" leftIcon={cartBusyId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} onClick={() => handleRemoveFromCart(item.id)} disabled={cartBusyId === item.id}>
                                Remove
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between p-4 border-t border-surface-200 dark:border-surface-700">
                  <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                    Total: {formatCurrency(cartTotal)}
                  </span>
                  <Button leftIcon={<CreditCard className="w-4 h-4" />}>
                    Checkout All ({cart.length} item{cart.length !== 1 ? 's' : ''})
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;
