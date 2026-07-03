import { ShoppingCart, BookOpen } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { formatCurrency } from '../../utils/formatters';
import type { Manual } from '../../types';

interface ManualCardProps { manual: Manual; onPurchase?: () => void; isPurchased?: boolean; }

const ManualCard = ({ manual, onPurchase, isPurchased }: ManualCardProps) => (
  <Card hover>
    <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 flex items-center justify-center mb-3 overflow-hidden">
      {manual.coverImageUrl ? (
        <img src={manual.coverImageUrl} alt={manual.title} className="w-full h-full object-cover" />
      ) : (
        <BookOpen className="w-12 h-12 text-primary-400" />
      )}
    </div>
    <h4 className="font-semibold text-surface-900 dark:text-surface-100 text-sm mb-1 line-clamp-2">{manual.title}</h4>
    <p className="text-xs text-surface-500 mb-2 line-clamp-2">{manual.description}</p>
    <div className="flex items-center justify-between">
      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatCurrency(manual.price)}</span>
      <Badge variant="outline">Level {manual.level}</Badge>
    </div>
    {isPurchased ? (
      <Badge variant="success" className="w-full justify-center mt-3">Purchased</Badge>
    ) : onPurchase ? (
      <button onClick={onPurchase} className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-medium bg-primary-500 text-white py-2 rounded-lg hover:bg-primary-600 transition-colors">
        <ShoppingCart className="w-4 h-4" /> Add to Cart
      </button>
    ) : null}
  </Card>
);

export default ManualCard;
