import { Star, ArrowRightLeft, DollarSign } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { getInitials, formatCurrency } from '../../utils/formatters';
import type { SkillListing } from '../../types';

interface SkillCardProps { skill: SkillListing; onClick?: () => void; }

const levelColors = { beginner: 'info', intermediate: 'warning', expert: 'success' } as const;

const SkillCard = ({ skill, onClick }: SkillCardProps) => (
  <Card hover onClick={onClick}>
    <div className="flex items-start gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-400 to-primary-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
        {skill.user ? getInitials(skill.user.firstName || '', skill.user.lastName || '') : '??'}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-surface-900 dark:text-surface-100 truncate">{skill.title}</h4>
        <p className="text-xs text-surface-500">{skill.user?.firstName} {skill.user?.lastName}</p>
      </div>
    </div>
    {skill.description && <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-3">{skill.description}</p>}
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <Badge variant={levelColors[skill.level]}>{skill.level}</Badge>
      {skill.category && <Badge variant="outline">{skill.category.name}</Badge>}
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-700">
      <div className="flex items-center gap-3 text-xs text-surface-500">
        {skill.isBarterAvailable && <span className="flex items-center gap-1"><ArrowRightLeft className="w-3.5 h-3.5" /> Trade</span>}
        {skill.isPaid && skill.price && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {formatCurrency(skill.price)}</span>}
      </div>
      {skill.averageRating !== undefined && (
        <span className="flex items-center gap-1 text-xs text-amber-500"><Star className="w-3.5 h-3.5 fill-current" /> {skill.averageRating.toFixed(1)}</span>
      )}
    </div>
  </Card>
);

export default SkillCard;
