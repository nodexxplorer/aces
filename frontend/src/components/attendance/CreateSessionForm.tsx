import { useState } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { MapPin, Plus } from 'lucide-react';
import { createVerifiedSession, attendanceLocation } from '../../api/verified-attendance';

interface CreateSessionFormProps {
  courseId: string;
  semesterId: string;
  onCreated: () => void;
}

const field =
  'w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-transparent p-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition';

export default function CreateSessionForm({ courseId, semesterId, onCreated }: CreateSessionFormProps) {
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [duration, setDuration] = useState(15);
  const [radius, setRadius] = useState(100);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await createVerifiedSession({
        courseId,
        semesterId,
        title: title.trim(),
        venue: venue.trim(),
        scheduledAt: new Date(scheduled).toISOString(),
        durationMinutes: duration,
        radiusM: radius,
        latitude: latitude === '' ? null : Number(latitude),
        longitude: longitude === '' ? null : Number(longitude),
      });
      setTitle('');
      setVenue('');
      setScheduled('');
      setDuration(15);
      setRadius(100);
      setLatitude('');
      setLongitude('');
      onCreated();
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to create session. Check your inputs.',
      );
    } finally {
      setBusy(false);
    }
  };

  const getCurrentLocation = async () => {
    const pos = await attendanceLocation();
    if (pos) {
      setLatitude(String(pos.latitude));
      setLongitude(String(pos.longitude));
    } else {
      setError('Location unavailable. Enter coordinates manually or use supervised review.');
    }
  };

  return (
    <Card>
      <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
        <h3 className="font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Attendance Session
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Session title</span>
            <input
              className={field}
              required
              maxLength={200}
              placeholder="e.g. Lecture 16 — Recursion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Venue</span>
            <input
              className={field}
              required
              maxLength={200}
              placeholder="e.g. Room 204, Block B"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Scheduled start</span>
            <input
              className={field}
              type="datetime-local"
              required
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              Check-in window (minutes)
            </span>
            <input
              className={field}
              type="number"
              min={1}
              max={180}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Venue latitude</span>
            <input
              className={field}
              type="number"
              min={-90}
              max={90}
              step="any"
              placeholder="Optional"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Venue longitude</span>
            <input
              className={field}
              type="number"
              min={-180}
              max={180}
              step="any"
              placeholder="Optional"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Review radius (metres)</span>
            <input
              className={field}
              type="number"
              min={20}
              max={1000}
              required
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </label>

          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void getCurrentLocation()} disabled={busy}>
              <MapPin className="w-4 h-4" />
              Use current location
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <Button type="submit" disabled={busy} isLoading={busy}>
          <Plus className="w-4 h-4" />
          Create draft session
        </Button>
      </form>
    </Card>
  );
}
