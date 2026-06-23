import { cn } from '../../utils/cn';
import { formatTimeAgo, getInitials } from '../../utils/formatters';

interface MessageBubbleProps {
  content: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: string;
  isMine: boolean;
}

const MessageBubble = ({ content, senderName, senderAvatar, timestamp, isMine }: MessageBubbleProps) => (
  <div className={cn('flex gap-2 max-w-[80%]', isMine ? 'ml-auto flex-row-reverse' : '')}>
    {!isMine && (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
        {senderAvatar ? <img src={senderAvatar} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(senderName.split(' ')[0] || '', senderName.split(' ')[1] || '')}
      </div>
    )}
    <div>
      {!isMine && <p className="text-xs text-surface-500 mb-1 ml-1">{senderName}</p>}
      <div className={cn(
        'px-4 py-2.5 rounded-2xl text-sm',
        isMine ? 'bg-primary-500 text-white rounded-br-md' : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-100 rounded-bl-md'
      )}>
        {content}
      </div>
      <p className={cn('text-[10px] text-surface-400 mt-1', isMine ? 'text-right mr-1' : 'ml-1')}>{formatTimeAgo(timestamp)}</p>
    </div>
  </div>
);

export default MessageBubble;
