import { useState } from 'react';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import ManualCard from '../../components/ui/ManualCard';
import Modal from '../../components/ui/Modal';
import { useCartStore } from '../../stores/cartStore';
import { useNotification } from '../../hooks/useNotification';
import { ShoppingCart, Search, Trash2, CheckCircle } from 'lucide-react';
import type { Manual } from '../../types';

const mockManuals: Manual[] = [
  { id: 'm-1', title: 'CPE 511: Embedded Systems Design', description: 'Lab workbook and theory overview for CPE 511 course instruction.', price: 3500, level: 5, semester: 'first', isActive: true, coverImageUrl: '', authorId: 'lec-1', code: 'CPE511-M', createdAt: '' },
  { id: 'm-2', title: 'CPE 513: Computer Architecture II', description: 'Lecture companion notes covering pipelining, hazards, and microcode.', price: 4000, level: 5, semester: 'first', isActive: true, coverImageUrl: '', authorId: 'lec-1', code: 'CPE513-M', createdAt: '' },
  { id: 'm-3', title: 'EEE 511: Control Engineering I', description: 'Reference handbook on transfer functions, bode plots, and controllers.', price: 3000, level: 5, semester: 'first', isActive: true, coverImageUrl: '', authorId: 'lec-2', code: 'EEE511-M', createdAt: '' },
];

const ManualsPage = () => {
  const { items, addItem, removeItem, clearCart, getTotal, getItemCount } = useCartStore();
  const { success, error } = useNotification();
  const [level, setLevel] = useState('5');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const filtered = mockManuals.filter(
    (m) =>
      m.level === parseInt(level) &&
      m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      success('Purchase Successful', `Bought ${getItemCount()} manuals. Added to download vault.`);
      clearCart();
      setCartOpen(false);
    } catch {
      error('Checkout Error', 'Gateway timeout.');
    } finally {
      setCheckingOut(false);
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
        <Button variant="outline" leftIcon={<ShoppingCart className="w-4 h-4" />} onClick={() => setCartOpen(true)}>
          Cart ({getItemCount()})
        </Button>
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
            { value: '1', label: '100 Level' },
            { value: '2', label: '200 Level' },
            { value: '3', label: '300 Level' },
            { value: '4', label: '400 Level' },
            { value: '5', label: '500 Level' },
          ]}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((m) => (
          <ManualCard key={m.id} manual={m} onPurchase={() => addItem(m)} />
        ))}
      </div>

      <Modal isOpen={cartOpen} onClose={() => setCartOpen(false)} title="Shopping Cart">
        {items.length === 0 ? (
          <p className="text-sm text-surface-400 text-center py-6">Your shopping cart is empty.</p>
        ) : (
          <div className="space-y-4">
            <div className="divide-y divide-surface-150 dark:divide-surface-800">
              {items.map(({ manual }) => (
                <div key={manual.id} className="flex justify-between items-center py-3">
                  <div>
                    <h5 className="text-sm font-semibold">{manual.title}</h5>
                    <p className="text-xs text-primary-500 font-semibold">{manual.price} NGN</p>
                  </div>
                  <button onClick={() => removeItem(manual.id)} className="p-1 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-surface-200 dark:border-surface-800 flex justify-between items-center">
              <span className="text-sm font-semibold">Total Balance</span>
              <span className="text-lg font-bold text-primary-500">{getTotal()} NGN</span>
            </div>
            <Button className="w-full mt-4" isLoading={checkingOut} onClick={handleCheckout} leftIcon={<CheckCircle className="w-4 h-4" />}>
              Pay & Checkout
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ManualsPage;
