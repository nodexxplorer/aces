import { Calendar, MapPin, Users, Video } from 'lucide-react';
import Card from './Card';
import Badge from './Badge';
import type { AlumniEvent } from '../../types';
import { formatDate } from '../../utils/formatters';

const eventTypeColors = { networking: 'primary', reunion: 'success', workshop: 'warning', mentorship: 'info' } as const;

interface EventCardProps { event: AlumniEvent; onRegister?: () => void; onClick?: () => void; }

const EventCard = ({ event, onRegister, onClick }: EventCardProps) => (
  <Card hover onClick={onClick}>
    <div className="flex items-start justify-between mb-2">
      <Badge variant={eventTypeColors[event.eventType]}>{event.eventType}</Badge>
      {event.isVirtual && <span className="flex items-center gap-1 text-xs text-accent-600 dark:text-accent-400"><Video className="w-3.5 h-3.5" /> Virtual</span>}
    </div>
    <h4 className="font-semibold text-surface-900 dark:text-surface-100 mb-1">{event.title}</h4>
    {event.description && <p className="text-sm text-surface-500 line-clamp-2 mb-3">{event.description}</p>}
    <div className="flex items-center gap-3 text-xs text-surface-500 flex-wrap">
      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(event.eventDate, 'MMM d, yyyy · h:mm a')}</span>
      {event.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>}
      {event.maxAttendees && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {event.attendeeCount || 0}/{event.maxAttendees}</span>}
    </div>
    {onRegister && (
      <button onClick={(e) => { e.stopPropagation(); onRegister(); }} className="mt-3 w-full text-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 py-2 rounded-lg transition-colors">
        Register
      </button>
    )}
  </Card>
);

export default EventCard;
