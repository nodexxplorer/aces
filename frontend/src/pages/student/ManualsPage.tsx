import { useState, useEffect } from 'react';
import Select from '../../components/ui/Select';
import ManualCard from '../../components/ui/ManualCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { ShoppingCart, Search, Loader2, BookOpen, Receipt, ShoppingBag } from 'lucide-react';
import { getManuals, getMyPurchases, downloadReceipt } from '../../api/manuals';
import { useCartStore } from '../../stores/cartStore';
import type { Manual, ManualPurchase } from '../../api/manuals';

type Tab = 'browse' | 'my';

const ManualsPage = () => {
  const { success, error: notifyError } = useNotification();
  const params = new URLSearchParams(window.location.search);
  const [activeTab, setActiveTab] = useState<Tab>(params.get('tab') === 'my' ? 'my' : 'browse');

  const [manuals, setManuals] = useState<Manual[]>([]);
  const [purchases, setPurchases] = useState<ManualPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const addItem = useCartStore((s) => s.addItem);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const cartItems = useCartStore((s) => s.items);
  const cartManualIds = new Set(cartItems.map((i) => i.manual.id));
  const purchasedIds = new Set(purchases.map((p) => p.manual_id));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [manualsData, purchasesData] = await Promise.allSettled([getManuals(), getMyPurchases()]);
      if (manualsData.status === 'fulfilled') {
        setManuals(Array.isArray(manualsData.value) ? manualsData.value : []);
      }
      if (purchasesData.status === 'fulfilled') {
        setPurchases(Array.isArray(purchasesData.value) ? purchasesData.value : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filtered = manuals.filter(
    (m) =>
      m.is_active &&
      (!level || m.level === parseInt(level)) &&
      (!searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleAddToCart = (manual: Manual) => {
    addItem({
      id: manual.id,
      title: manual.title,
      description: manual.description || '',
      price: manual.price,
      level: manual.level,
      isActive: manual.is_active,
      coverImageUrl: manual.cover_image_url,
      createdAt: manual.created_at,
    });
    success('Added to Cart', `"${manual.title}" added to your cart.`);
  };

  const handleDownloadReceipt = async (purchase: ManualPurchase) => {
    try {
      setDownloadingId(purchase.id);
      const blob = await downloadReceipt(purchase.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${purchase.manual_title || 'manual'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      notifyError('Download Failed', 'Could not download receipt.');
    } finally {
      setDownloadingId(null);
    }
  };

  const tabs = [
    { key: 'browse' as Tab, label: 'Browse Manuals', icon: ShoppingBag },
    { key: 'my' as Tab, label: `My Manuals${purchases.length > 0 ? ` (${purchases.length})` : ''}`, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Manuals</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Purchase recommended textbooks and laboratory manuals, and manage what you already own.
          </p>
        </div>
        <a
          href="/payments?tab=cart"
          className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40 text-sm font-medium transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          View Cart
          {getItemCount() > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-primary-500 rounded-full">
              {getItemCount()}
            </span>
          )}
        </a>
      </div>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'browse' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-3 max-w-xl">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search manuals..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              options={[
                { value: '', label: 'All Levels' },
                { value: '100', label: '100 Level' },
                { value: '200', label: '200 Level' },
                { value: '300', label: '300 Level' },
                { value: '400', label: '400 Level' },
                { value: '500', label: '500 Level' },
              ]}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading manuals...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-surface-500">
              <p>No manuals found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((m) => (
                <ManualCard
                  key={m.id}
                  manual={{
                    id: m.id,
                    title: m.title,
                    description: m.description || '',
                    price: m.price,
                    level: m.level,
                    isActive: m.is_active,
                    coverImageUrl: m.cover_image_url,
                    createdAt: m.created_at,
                  }}
                  isPurchased={purchasedIds.has(m.id)}
                  isInCart={cartManualIds.has(m.id)}
                  onPurchase={purchasedIds.has(m.id) || cartManualIds.has(m.id) ? undefined : () => handleAddToCart(m)}
                />
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          <span className="ml-2 text-sm text-surface-500">Loading manuals...</span>
        </div>
      ) : purchases.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-surface-300" />
            <p className="text-sm text-surface-500">No manuals purchased yet.</p>
            <button
              onClick={() => setActiveTab('browse')}
              className="mt-3 inline-block text-sm text-primary-600 hover:underline"
            >
              Browse Manuals
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchases.map((p) => (
            <Card key={p.id} hover>
              <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 flex items-center justify-center mb-3">
                <BookOpen className="w-12 h-12 text-primary-400" />
              </div>
              <h4 className="font-semibold text-surface-900 dark:text-white text-sm mb-1 line-clamp-2">
                {p.manual_title || 'Manual'}
              </h4>
              <p className="text-xs text-surface-500 mb-2">
                Level {p.manual_level || 'N/A'} | &#8358;{Number(p.price).toLocaleString()}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                <StatusBadge status={p.is_collected ? 'collected' : 'active'} />
                {p.purchased_at && (
                  <span className="text-[10px] text-surface-400">
                    Purchased {new Date(p.purchased_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                leftIcon={
                  downloadingId === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4" />
                  )
                }
                onClick={() => handleDownloadReceipt(p)}
                disabled={downloadingId === p.id}
              >
                Download Receipt
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManualsPage;
