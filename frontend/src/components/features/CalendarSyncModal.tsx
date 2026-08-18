import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { CalendarPlus, Copy, RefreshCw } from 'lucide-react';
import { getMyCalendarToken, regenerateMyCalendarToken, getCalendarFeedUrl } from '../../api/calendar';

const CalendarSyncModal = () => {
  const { success, error: notifyError } = useNotification();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');

  const openModal = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const token = await getMyCalendarToken();
      setFeedUrl(getCalendarFeedUrl(token));
    } catch {
      notifyError('Error', 'Failed to load your calendar link');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      success('Copied', 'Calendar link copied to clipboard');
    } catch {
      notifyError('Error', 'Could not copy — select and copy the link manually');
    }
  };

  const regenerate = async () => {
    if (!confirm('This breaks the old link — anywhere you already subscribed with it will stop updating. Continue?')) {
      return;
    }
    setRegenerating(true);
    try {
      const token = await regenerateMyCalendarToken();
      setFeedUrl(getCalendarFeedUrl(token));
      success('Link Regenerated', 'Update your calendar subscription with the new link');
    } catch {
      notifyError('Error', 'Failed to regenerate calendar link');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <>
      <Button variant="outline" leftIcon={<CalendarPlus className="w-4 h-4" />} onClick={openModal}>
        Sync to Google Calendar
      </Button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Sync to Google Calendar" size="md">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-surface-600 dark:text-surface-400">
              This link keeps your class schedule and task due dates synced to any calendar app. In Google Calendar:{' '}
              <strong>Other calendars → + → From URL</strong>, then paste the link below.
            </p>

            <div className="flex gap-2">
              <Input readOnly value={feedUrl} onFocus={(e) => e.target.select()} className="flex-1" />
              <Button variant="outline" onClick={copyLink} leftIcon={<Copy className="w-4 h-4" />}>
                Copy
              </Button>
            </div>

            <div className="flex items-start gap-2 bg-warning-50 dark:bg-warning-500/10 rounded-lg p-3">
              <p className="text-xs text-warning-700 dark:text-warning-500">
                Anyone with this link can see your schedule and tasks. Keep it private, and regenerate it below if it's
                ever shared by accident. Calendar apps typically refresh a subscribed link every few hours, not
                instantly.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              isLoading={regenerating}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={regenerate}
            >
              Regenerate Link
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CalendarSyncModal;
