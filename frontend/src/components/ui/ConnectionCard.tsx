import { UserPlus, MessageCircle, MoreHorizontal } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import { getInitials } from '../../utils/formatters';
import type { User } from '../../types';

interface ConnectionCardProps {
  user: User;
  connectionStatus?: 'none' | 'pending' | 'connected';
  matchScore?: number;
  onConnect?: () => void;
  onMessage?: () => void;
  onViewProfile?: () => void;
}

const ConnectionCard = ({ user, connectionStatus = 'none', matchScore, onConnect, onMessage, onViewProfile }: ConnectionCardProps) => (
  <Card hover className="flex flex-col" onClick={onViewProfile}>
    <div className="flex items-start gap-3 mb-3">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
        {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(user.firstName || '', user.lastName || '')}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-surface-900 dark:text-surface-100 truncate">{user.firstName} {user.lastName}</h4>
        <p className="text-xs text-surface-500 dark:text-surface-400 capitalize">{user.activeRole.replace('_', ' ')}</p>
      </div>
      {matchScore !== undefined && <Badge variant="info">{matchScore}% match</Badge>}
    </div>
    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-surface-100 dark:border-surface-700">
      {connectionStatus === 'none' && onConnect && (
        <button onClick={(e) => { e.stopPropagation(); onConnect(); }} className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
          <UserPlus className="w-3.5 h-3.5" /> Connect
        </button>
      )}
      {connectionStatus === 'pending' && <Badge variant="warning">Pending</Badge>}
      {connectionStatus === 'connected' && onMessage && (
        <button onClick={(e) => { e.stopPropagation(); onMessage(); }} className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
          <MessageCircle className="w-3.5 h-3.5" /> Message
        </button>
      )}
      <button className="ml-auto p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg"><MoreHorizontal className="w-4 h-4" /></button>
    </div>
  </Card>
);

export default ConnectionCard;
