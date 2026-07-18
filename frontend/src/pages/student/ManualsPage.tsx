import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import ManualCard from '../../components/ui/ManualCard';
import { useNotification } from '../../hooks/useNotification';
import { ShoppingCart, Search, CheckCircle, Loader2 } from 'lucide-react';
import { getManuals, purchaseManual, getMyPurchases } from '../../api/manuals';
import type { Manual } from '../../api/manuals';

const ManualsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [buyingId, setBuyingId] = useState<string | null>(null);

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
      (!searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleBuy = async (manual: Manual) => {
    try {
      setBuyingId(manual.id);
      await purchaseManual(manual.id);
      setPurchasedIds((prev) => new Set([...prev, manual.id]));
      success('Purchase Successful', `"${manual.title}" purchased. Check "My Manuals" for your QR code.`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Purchase failed';
      if (msg.includes('already purchased')) {
        notifyError('Already Purchased', 'You have already purchased this manual.');
      } else {
        notifyError('Purchase Failed', msg);
      }
    } finally {
      setBuyingId(null);
    }
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
      </div>

      <div className="flex gap-4 max-w-xl">
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
          onChange={(e) => { setLevel(e.target.value); }}
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
              onPurchase={purchasedIds.has(m.id) ? undefined : () => handleBuy(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ManualsPage;
