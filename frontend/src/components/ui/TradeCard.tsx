import { ArrowLeftRight } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { getInitials } from '../../utils/formatters';
import type { TradeOffer } from '../../types';

const statusColors = { pending: 'warning', accepted: 'info', rejected: 'danger', completed: 'success', cancelled: 'default' } as const;

interface TradeCardProps { trade: TradeOffer; onClick?: () => void; }

const TradeCard = ({ trade, onClick }: TradeCardProps) => (
  <Card hover onClick={onClick}>
    <div className="flex items-center justify-between mb-3">
      <Badge variant={statusColors[trade.status]}>{trade.status}</Badge>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex-1 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-semibold mb-1">
          {trade.offerer ? getInitials(trade.offerer.firstName || '', trade.offerer.lastName || '') : '??'}
        </div>
        <p className="text-xs font-medium text-surface-900 dark:text-surface-100 truncate">{trade.offerer?.firstName}</p>
        <p className="text-[10px] text-surface-500 truncate">{trade.offererSkill?.title || 'Offering skill'}</p>
      </div>
      <ArrowLeftRight className="w-5 h-5 text-primary-500 shrink-0" />
      <div className="flex-1 text-center">
        <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white text-xs font-semibold mb-1">
          {trade.recipient ? getInitials(trade.recipient.firstName || '', trade.recipient.lastName || '') : '??'}
        </div>
        <p className="text-xs font-medium text-surface-900 dark:text-surface-100 truncate">{trade.recipient?.firstName}</p>
        <p className="text-[10px] text-surface-500 truncate">{trade.recipientSkill?.title || 'Requesting skill'}</p>
      </div>
    </div>
    {trade.offererDescription && <p className="text-xs text-surface-500 mt-3 line-clamp-2">{trade.offererDescription}</p>}
  </Card>
);

export default TradeCard;
