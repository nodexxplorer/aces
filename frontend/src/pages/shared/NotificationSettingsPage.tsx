import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import { useNotificationStore } from '../../stores/notificationStore';
import { useNotification } from '../../hooks/useNotification';
import { cn } from '../../utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}

const Toggle = ({ checked, onChange, label }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
      checked ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
    )}
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
        checked ? 'translate-x-4' : 'translate-x-0'
      )}
    />
  </button>
);

const categories = [
  { key: 'auth', label: 'Authentication' },
  { key: 'results', label: 'Results' },
  { key: 'dues', label: 'Dues & Payments' },
  { key: 'messages', label: 'Messages' },
  { key: 'connect', label: 'Campus Connect' },
  { key: 'alumni', label: 'Alumni' },
  { key: 'system', label: 'System' },
] as const;

const NotificationSettingsPage = () => {
  const preferences = useNotificationStore((s) => s.preferences);
  const fetchPreferences = useNotificationStore((s) => s.fetchPreferences);
  const updatePreferences = useNotificationStore((s) => s.updatePreferences);
  const { success, error: notifyError } = useNotification();
  const [saving, setSaving] = useState(false);
  const [localPrefs, setLocalPrefs] = useState(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  useEffect(() => {
    if (preferences) setLocalPrefs(preferences);
  }, [preferences]);

  const updateField = async (field: string, value: boolean | string | null) => {
    if (!localPrefs) return;
    const updated = { ...localPrefs, [field]: value };
    setLocalPrefs(updated);
    setHasChanges(true);

    if (typeof value === 'boolean') {
      try {
        await updatePreferences(updated);
        setHasChanges(false);
        success('Setting Updated', 'Notification preference saved.');
      } catch {
        notifyError('Error', 'Failed to save preference setting.');
      }
    }
  };

  const handleSave = async () => {
    if (!localPrefs) return;
    setSaving(true);
    try {
      await updatePreferences(localPrefs);
      setHasChanges(false);
      success('Saved', 'Notification preferences updated.');
    } catch {
      notifyError('Error', 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (!localPrefs) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Card className="p-6 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          to="/notifications"
          className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Notification Settings</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage how you receive notifications
          </p>
        </div>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Channels</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300">In-App Notifications</p>
              <p className="text-xs text-surface-400 dark:text-surface-500">Show notifications in the app</p>
            </div>
            <Toggle
              checked={localPrefs.in_app_enabled}
              onChange={(v) => updateField('in_app_enabled', v)}
              label="In-app notifications"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Email Notifications</p>
              <p className="text-xs text-surface-400 dark:text-surface-500">Receive notifications via email</p>
            </div>
            <Toggle
              checked={localPrefs.email_enabled}
              onChange={(v) => updateField('email_enabled', v)}
              label="Email notifications"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Push Notifications</p>
              <p className="text-xs text-surface-400 dark:text-surface-500">Receive push notifications on your device</p>
            </div>
            <Toggle
              checked={localPrefs.push_enabled}
              onChange={(v) => updateField('push_enabled', v)}
              label="Push notifications"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Email by Category</h2>
        <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
          {categories.map(({ key, label }) => {
            const field = `email_${key}` as keyof typeof localPrefs;
            return (
              <div key={key} className="flex items-center justify-between py-3">
                <span className="text-sm text-surface-700 dark:text-surface-300">{label}</span>
                <Toggle
                  checked={!!localPrefs[field]}
                  onChange={(v) => updateField(field, v)}
                  label={`${label} email`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4">Push by Category</h2>
        <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
          {categories.map(({ key, label }) => {
            const field = `push_${key}` as keyof typeof localPrefs;
            return (
              <div key={key} className="flex items-center justify-between py-3">
                <span className="text-sm text-surface-700 dark:text-surface-300">{label}</span>
                <Toggle
                  checked={!!localPrefs[field]}
                  onChange={(v) => updateField(field, v)}
                  label={`${label} push`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Quiet Hours
        </h2>
        <p className="text-xs text-surface-400 dark:text-surface-500 mb-4">
          No notifications during these hours
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">Start</label>
            <input
              type="time"
              value={localPrefs.quiet_hours_start || ''}
              onChange={(e) => {
                updateField('quiet_hours_start', e.target.value || null);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 dark:text-surface-400 mb-1 block">End</label>
            <input
              type="time"
              value={localPrefs.quiet_hours_end || ''}
              onChange={(e) => {
                updateField('quiet_hours_end', e.target.value || null);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          isLoading={saving}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
