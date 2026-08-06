import { useState, useEffect } from 'react';
import Select from '../../components/ui/Select';
import ManualCard from '../../components/ui/ManualCard';
import { useNotification } from '../../hooks/useNotification';
import { ShoppingCart, Search, Loader2 } from 'lucide-react';
import { getManuals, getMyPurchases } from '../../api/manuals';
import { useCartStore } from '../../stores/cartStore';
import type { Manual } from '../../api/manuals';

const ManualsPage = () => {
  const { success } = useNotification();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  const addItem = useCartStore((s) => s.addItem);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const cartItems = useCartStore((s) => s.items);
  const cartManualIds = new Set(cartItems.map((i) => i.manual.id));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [manualsData, purchasesData] = await Promise.allSettled([
        getManuals(level ? { level: parseInt(level) } : undefined),
        getMyPurchases(),
      ]);
      if (manualsData.status === 'fulfilled') {
        setManuals(Array.isArray(manualsData.value) ? manualsData.value : []);
      }
      if (purchasesData.status === 'fulfilled') {
        const items = Array.isArray(purchasesData.value) ? purchasesData.value : [];
        setPurchasedIds(new Set(items.map((p) => p.manual_id)));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Manuals</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Purchase recommended textbooks and laboratory manuals.
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
            { value: '1', label: '100 Level' },
            { value: '2', label: '200 Level' },
            { value: '3', label: '300 Level' },
            { value: '4', label: '400 Level' },
            { value: '5', label: '500 Level' },
          ]}
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
          }}
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
  );
};

export default ManualsPage;
