import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { Calendar, MapPin, Users, Video, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { getAlumniEvents, registerForEvent, getEventAttendees } from '../../api/alumni';
import type { AlumniEventItem, EventAttendee } from '../../types';

const eventTypeLabels: Record<string, string> = {
  homecoming: 'Homecoming',
  networking: 'Networking',
  workshop: 'Workshop',
  fundraiser: 'Fundraiser',
  dinner: 'Dinner',
  reunion: 'Reunion',
  seminar: 'Seminar',
  other: 'Other',
};

const AlumniEventsPage = () => {
  const { success, error: notifyError } = useNotification();
  const [events, setEvents] = useState<AlumniEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<AlumniEventItem | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAlumniEvents()
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRegister = async (event: AlumniEventItem) => {
    setRegistering(true);
    try {
      await registerForEvent(event.id);
      success('Registered', `You are registered for "${event.title}"`);
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, attendee_count: (e.attendee_count || 0) + 1 } : e))
      );
      setSelectedEvent(null);
    } catch (error: unknown) {
      const errorObj = error as any;
      const message =
        errorObj?.response?.data?.error || (error instanceof Error ? error.message : 'Could not register for this event');
      notifyError('Failed', message);
    } finally {
      setRegistering(false);
    }
  };

  const handleViewAttendees = async (event: AlumniEventItem) => {
    setSelectedEvent(event);
    setAttendeesOpen(true);
    try {
      const data = await getEventAttendees(event.id);
      setAttendees(Array.isArray(data) ? data : []);
    } catch {
      setAttendees([]);
    }
  };

  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.end_date >= now || e.is_active);
  const past = events.filter((e) => e.end_date < now && !e.is_active);

  const renderEventCard = (event: AlumniEventItem) => {
    const isFull = event.max_attendees && (event.attendee_count || 0) >= event.max_attendees;
    const eventDate = new Date(event.start_date);
    const isPast = new Date(event.end_date) < new Date();

    return (
      <Card key={event.id} hover className="p-6 flex gap-4">
        <div className="p-3 bg-primary-50 dark:bg-primary-950/20 text-primary-500 rounded-lg shrink-0 h-fit">
          <Calendar className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-lg text-surface-900 dark:text-white">{event.title}</h3>
            <Badge variant={event.event_type === 'fundraiser' ? 'warning' : event.event_type === 'networking' ? 'success' : 'primary'}>
              {eventTypeLabels[event.event_type] || event.event_type}
            </Badge>
          </div>
          {event.description && (
            <p className="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-3">{event.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-surface-500 mb-3 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {eventDate.toLocaleDateString()} {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {event.location && (
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {event.location}</span>
            )}
            {event.is_virtual && (
              <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Virtual</span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {event.attendee_count || 0}{event.max_attendees ? `/${event.max_attendees}` : ''} attending
            </span>
            {event.target_audience && <Badge variant="outline">{event.target_audience}</Badge>}
          </div>
          <div className="flex gap-2">
            {!isPast && (
              <Button
                size="sm"
                leftIcon={registering ? undefined : <CheckCircle className="w-4 h-4" />}
                isLoading={registering}
                disabled={!!isFull}
                onClick={() => handleRegister(event)}
              >
                {isFull ? 'Full' : 'Register'}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => handleViewAttendees(event)}>
              Attendees
            </Button>
            {event.is_virtual && event.virtual_link && (
              <a href={event.virtual_link} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" leftIcon={<Video className="w-4 h-4" />}>Join</Button>
              </a>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Events</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Stay updated on alumni dinners, fundraisers and technical networking summits.
        </p>
      </div>

      {loading ? (
        <Card>
          <div className="flex items-center justify-center p-12 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            <span className="text-sm text-surface-500">Loading events...</span>
          </div>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-sm text-surface-400">No events available yet. Check back soon!</div>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">Upcoming Events</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {upcoming.map(renderEventCard)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-surface-500 dark:text-surface-400 mb-3">Past Events</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-70">
                {past.map(renderEventCard)}
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={attendeesOpen} onClose={() => setAttendeesOpen(false)} title={selectedEvent ? `Attendees — ${selectedEvent.title}` : 'Attendees'}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {attendees.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">No attendees yet</p>
          ) : (
            attendees.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-400">
                  {(a.user?.firstName || a.userId)?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">
                    {a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Unknown'}
                  </p>
                  <p className="text-xs text-surface-500">{new Date(a.registeredAt).toLocaleDateString()}</p>
                </div>
                <Badge
                  variant={
                    String(a.status) === 'attending'
                      ? 'success'
                      : String(a.status) === 'waitlisted'
                      ? 'warning'
                      : 'secondary'
                  }
                  className="ml-auto"
                >
                  {a.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AlumniEventsPage;
