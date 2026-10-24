import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  Bell,
  Mail,
  Smartphone,
  Lock,
  Award,
  CreditCard,
  MessageSquare,
  Users,
  Megaphone,
  Sparkles,
  Moon,
  Clock,
  Check,
  Loader2,
  Edit2,
  X,
} from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

const Switch = ({ checked, onChange, disabled }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500/20',
      checked ? 'bg-primary-600' : 'bg-surface-300 dark:bg-surface-700',
      disabled && 'opacity-50 cursor-not-allowed',
    )}
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
        checked ? 'translate-x-5' : 'translate-x-0',
      )}
    />
  </button>
);

const TOPICS = [
  {
    key: 'auth',
    label: 'Authentication',
    desc: 'Sign-in alerts and security codes',
    icon: Lock,
  },
  {
    key: 'results',
    label: 'Results',
    desc: 'When new results are published',
    icon: Award,
  },
  {
    key: 'dues',
    label: 'Dues & Payments',
    desc: 'Dues reminders and receipts',
    icon: CreditCard,
  },
  {
    key: 'messages',
    label: 'Messages',
    desc: 'New direct and group messages',
    icon: MessageSquare,
  },
  {
    key: 'connect',
    label: 'Campus Connect',
    desc: 'Connection requests and group invites',
    icon: Users,
  },
  {
    key: 'alumni',
    label: 'Alumni',
    desc: 'Updates from the alumni network',
    icon: Megaphone,
  },
  {
    key: 'system',
    label: 'System',
    desc: 'Maintenance and portal updates',
    icon: Sparkles,
  },
] as const;

const DEFAULT_PREFS = {
  id: '',
  user_id: '',
  email_enabled: true,
  push_enabled: true,
  in_app_enabled: true,
  email_auth: true,
  email_results: true,
  email_dues: true,
  email_messages: true,
  email_connect: true,
  email_skills: false,
  email_alumni: false,
  email_system: true,
  push_auth: true,
  push_results: true,
  push_dues: true,
  push_messages: false,
  push_connect: false,
  push_skills: false,
  push_alumni: false,
  push_system: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  updated_at: new Date().toISOString(),
};

function formatTime12h(timeStr?: string | null): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const m = parseInt(mStr, 10);
  if (m === 0) {
    return `${hour12} ${period}`;
  }
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const preferences = useNotificationStore((s) => s.preferences);
  const fetchPreferences = useNotificationStore((s) => s.fetchPreferences);
  const updatePreferences = useNotificationStore((s) => s.updatePreferences);
  const { success, error: notifyError } = useNotification();

  const [saving, setSaving] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(DEFAULT_PREFS);
  const [localPrefs, setLocalPrefs] = useState(DEFAULT_PREFS);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [savedQuietHoursEnabled, setSavedQuietHoursEnabled] = useState(true);
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  useEffect(() => {
    if (preferences) {
      const merged = {
        ...DEFAULT_PREFS,
        ...preferences,
        quiet_hours_start: preferences.quiet_hours_start || '22:00',
        quiet_hours_end: preferences.quiet_hours_end || '07:00',
      };
      setSavedPrefs(merged);
      setLocalPrefs(merged);
      const isQh = Boolean(preferences.quiet_hours_start && preferences.quiet_hours_end);
      setQuietHoursEnabled(isQh);
      setSavedQuietHoursEnabled(isQh);
    }
  }, [preferences]);

  // Compute detailed differences between savedPrefs and localPrefs
  const diffSummary = useMemo(() => {
    let pushDiffCount = 0;
    let emailDiffCount = 0;
    let channelDiffCount = 0;

    if (localPrefs.in_app_enabled !== savedPrefs.in_app_enabled) channelDiffCount++;
    if (localPrefs.email_enabled !== savedPrefs.email_enabled) channelDiffCount++;
    if (localPrefs.push_enabled !== savedPrefs.push_enabled) channelDiffCount++;

    TOPICS.forEach((t) => {
      const eKey = `email_${t.key}`;
      const pKey = `push_${t.key}`;
      if ((localPrefs as any)[eKey] !== (savedPrefs as any)[eKey]) emailDiffCount++;
      if ((localPrefs as any)[pKey] !== (savedPrefs as any)[pKey]) pushDiffCount++;
    });

    const qhChanged =
      quietHoursEnabled !== savedQuietHoursEnabled ||
      (quietHoursEnabled &&
        (localPrefs.quiet_hours_start !== savedPrefs.quiet_hours_start ||
          localPrefs.quiet_hours_end !== savedPrefs.quiet_hours_end));

    const totalCount = channelDiffCount + emailDiffCount + pushDiffCount + (qhChanged ? 1 : 0);

    const parts: string[] = [];
    if (pushDiffCount > 0) {
      parts.push(`${pushDiffCount} push topic${pushDiffCount > 1 ? 's' : ''}`);
    }
    if (emailDiffCount > 0) {
      parts.push(`${emailDiffCount} email topic${emailDiffCount > 1 ? 's' : ''}`);
    }
    if (channelDiffCount > 0) {
      parts.push(`${channelDiffCount} channel${channelDiffCount > 1 ? 's' : ''}`);
    }
    if (qhChanged) {
      parts.push('quiet hours');
    }

    return {
      hasChanges: totalCount > 0,
      totalCount,
      summaryText: parts.length > 0 ? parts.join(' and ') : '',
    };
  }, [localPrefs, savedPrefs, quietHoursEnabled, savedQuietHoursEnabled]);

  const updateField = (field: string, value: any) => {
    setLocalPrefs((prev) => ({ ...prev, [field]: value }));
  };

  const handleResetDefaults = () => {
    setLocalPrefs((prev) => ({
      ...prev,
      email_auth: true,
      email_results: true,
      email_dues: true,
      email_messages: true,
      email_connect: true,
      email_alumni: false,
      email_system: true,
      push_auth: true,
      push_results: true,
      push_dues: true,
      push_messages: false,
      push_connect: false,
      push_alumni: false,
      push_system: true,
    }));
  };

  const handleDiscard = () => {
    setLocalPrefs(savedPrefs);
    setQuietHoursEnabled(savedQuietHoursEnabled);
  };

  const handleSave = async () => {
    if (!localPrefs) return;
    setSaving(true);
    try {
      const payload = {
        ...localPrefs,
        quiet_hours_start: quietHoursEnabled ? localPrefs.quiet_hours_start : null,
        quiet_hours_end: quietHoursEnabled ? localPrefs.quiet_hours_end : null,
      };
      await updatePreferences(payload);
      setSavedPrefs(localPrefs);
      setSavedQuietHoursEnabled(quietHoursEnabled);
      setShowSavedToast(true);
      setTimeout(() => {
        setShowSavedToast(false);
      }, 5000);
      success('Saved', 'Notification preferences updated successfully.');
    } catch {
      notifyError('Error', 'Failed to save notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestNotification = () => {
    setTestingNotification(true);
    setTimeout(() => {
      setTestingNotification(false);
      success('Test Notification Sent', 'Your notification preview was sent to active channels.');
    }, 800);
  };

  // Counts for "Your setup" summary card
  const emailTopicsActive = useMemo(() => {
    return TOPICS.filter((t) => (localPrefs as any)[`email_${t.key}`]).length;
  }, [localPrefs]);

  const pushTopicsActive = useMemo(() => {
    return TOPICS.filter((t) => (localPrefs as any)[`push_${t.key}`]).length;
  }, [localPrefs]);

  // Timeline track calculation for quiet hours
  // Converts "22:00" and "07:00" into percentages on 24h axis
  const timelineSegments = useMemo(() => {
    if (!quietHoursEnabled) return null;
    const startStr = localPrefs.quiet_hours_start || '22:00';
    const endStr = localPrefs.quiet_hours_end || '07:00';

    const [sh, sm] = startStr.split(':').map((v) => parseInt(v, 10) || 0);
    const [eh, em] = endStr.split(':').map((v) => parseInt(v, 10) || 0);

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    if (startMinutes > endMinutes) {
      // Overnight split, e.g. 10 PM to 7 AM
      // Segment 1: 00:00 to endMinutes
      const leftWidthPercent = (endMinutes / 1440) * 100;
      // Segment 2: startMinutes to 24:00
      const rightWidthPercent = ((1440 - startMinutes) / 1440) * 100;
      return {
        isSplit: true,
        leftWidth: `${leftWidthPercent}%`,
        rightWidth: `${rightWidthPercent}%`,
      };
    } else {
      // Single continuous segment
      const leftOffset = (startMinutes / 1440) * 100;
      const width = ((endMinutes - startMinutes) / 1440) * 100;
      return {
        isSplit: false,
        leftOffset: `${leftOffset}%`,
        width: `${width}%`,
      };
    }
  }, [quietHoursEnabled, localPrefs.quiet_hours_start, localPrefs.quiet_hours_end]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Header Bar with Back Link & Title & Preferences Saved Toast */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-3">
            <Link
              to="/i/communication"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              <ChevronLeft className="w-4 h-4" /> Back to Communication
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight">
                Notification Settings
              </h1>
              <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                Choose how and when you want to hear from us.
              </p>
            </div>
          </div>

          {/* Preferences Saved Toast (Screenshots 1 & 4) */}
          {showSavedToast && (
            <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-3 sm:px-4 sm:py-3 shadow-md flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-surface-900 dark:text-surface-100">Preferences saved</p>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">Your changes are live.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedToast(false)}
                className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Controls */}
          <div className="lg:col-span-8 space-y-6">
            {/* Top 3 Channel Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* In-app Card */}
              <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <Bell className="w-5 h-5" />
                  </div>
                  <Switch checked={localPrefs.in_app_enabled} onChange={(v) => updateField('in_app_enabled', v)} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-surface-900 dark:text-surface-100">In-app</h3>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-1">
                    Show notifications inside the portal
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                    {localPrefs.in_app_enabled ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" /> On
                      </>
                    ) : (
                      <span className="text-surface-400">Off</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Email Card */}
              <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <Switch checked={localPrefs.email_enabled} onChange={(v) => updateField('email_enabled', v)} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-surface-900 dark:text-surface-100">Email</h3>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                    Sent to {user?.email || 'royaldlvinewill24@gmail.com'}
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                    {localPrefs.email_enabled ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" /> On
                      </>
                    ) : (
                      <span className="text-surface-400">Off</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Push Card */}
              <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-4 sm:p-5 shadow-sm flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <Switch checked={localPrefs.push_enabled} onChange={(v) => updateField('push_enabled', v)} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-surface-900 dark:text-surface-100">Push</h3>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-1">
                    Alerts on this device
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                    {localPrefs.push_enabled ? (
                      <>
                        <Check className="w-3 h-3 stroke-[3]" /> On
                      </>
                    ) : (
                      <span className="text-surface-400">Off</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Table Card: What should we notify you about? */}
            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-surface-100 dark:border-surface-800">
                <h2 className="text-base font-bold text-surface-900 dark:text-surface-100">
                  What should we notify you about?
                </h2>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                  Choose email and push for each topic
                </p>
              </div>

              {/* Header labels for columns */}
              <div className="px-5 sm:px-6 py-2.5 bg-surface-50/70 dark:bg-surface-950/40 border-b border-surface-100 dark:border-surface-800 flex items-center justify-between text-[11px] font-bold text-surface-400 uppercase tracking-wider">
                <span>TOPIC</span>
                <div className="flex items-center gap-8 sm:gap-12 mr-2 sm:mr-3">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> EMAIL
                  </span>
                  <span className="flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5" /> PUSH
                  </span>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {TOPICS.map((topic) => {
                  const Icon = topic.icon;
                  const emailKey = `email_${topic.key}`;
                  const pushKey = `push_${topic.key}`;
                  const emailActive = Boolean((localPrefs as any)[emailKey]);
                  const pushActive = Boolean((localPrefs as any)[pushKey]);

                  return (
                    <div
                      key={topic.key}
                      className="px-5 sm:px-6 py-4 flex items-center justify-between gap-4 hover:bg-surface-50/40 dark:hover:bg-surface-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-surface-900 dark:text-surface-100">{topic.label}</p>
                          <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5 truncate">
                            {topic.desc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 sm:gap-12 shrink-0">
                        <Switch
                          checked={emailActive}
                          onChange={(v) => updateField(emailKey, v)}
                          disabled={!localPrefs.email_enabled}
                        />
                        <Switch
                          checked={pushActive}
                          onChange={(v) => updateField(pushKey, v)}
                          disabled={!localPrefs.push_enabled}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 bg-surface-50/50 dark:bg-surface-950/30 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-xs">
                <span className="text-surface-500 dark:text-surface-400 text-[11px]">
                  Alumni updates are off by default.
                </span>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="font-bold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 text-xs"
                >
                  Reset to defaults
                </button>
              </div>
            </div>

            {/* Quiet Hours Card */}
            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Quiet hours</h3>
                    <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5">
                      No notifications during these hours. Urgent security alerts still come through.
                    </p>
                  </div>
                </div>
                <Switch checked={quietHoursEnabled} onChange={(v) => setQuietHoursEnabled(v)} />
              </div>

              {/* Timeline track (Accurately renders overnight split 10 PM - 7 AM as in Screenshots 1, 2, 3, 4) */}
              <div className="pt-2">
                <div className="h-2 rounded-full bg-surface-100 dark:bg-surface-800 relative overflow-hidden">
                  {timelineSegments?.isSplit ? (
                    <>
                      {/* Left segment (12 AM to 7 AM) */}
                      <div
                        className="h-full bg-primary-500 rounded-l-full absolute left-0 top-0 transition-all"
                        style={{ width: timelineSegments.leftWidth }}
                      />
                      {/* Right segment (10 PM to 12 AM) */}
                      <div
                        className="h-full bg-primary-500 rounded-r-full absolute right-0 top-0 transition-all"
                        style={{ width: timelineSegments.rightWidth }}
                      />
                    </>
                  ) : timelineSegments ? (
                    <div
                      className="h-full bg-primary-500 rounded-full absolute top-0 transition-all"
                      style={{
                        left: timelineSegments.leftOffset,
                        width: timelineSegments.width,
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex justify-between text-[10px] text-surface-400 mt-1.5 font-medium px-0.5">
                  <span>12 AM</span>
                  <span>6 AM</span>
                  <span>12 PM</span>
                  <span>6 PM</span>
                  <span>12 AM</span>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5 block">
                    Start
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={localPrefs.quiet_hours_start || '22:00'}
                      onChange={(e) => updateField('quiet_hours_start', e.target.value || null)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-950/40 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-medium"
                    />
                    <Clock className="w-4 h-4 text-surface-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5 block">
                    End
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={localPrefs.quiet_hours_end || '07:00'}
                      onChange={(e) => updateField('quiet_hours_end', e.target.value || null)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-950/40 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-medium"
                    />
                    <Clock className="w-4 h-4 text-surface-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Unsaved Changes Banner Bar (Screenshots 2 & 3) OR Single Save Button (Screenshots 1 & 4) */}
            {diffSummary.hasChanges ? (
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-surface-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-primary-600 dark:text-primary-400 shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-surface-900 dark:text-surface-100">
                      You have unsaved changes
                    </h4>
                    <p className="text-[11px] text-surface-500 dark:text-surface-400 truncate mt-0.5">
                      {diffSummary.totalCount} {diffSummary.totalCount === 1 ? 'change' : 'changes'}:{' '}
                      {diffSummary.summaryText}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-4 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 text-xs font-semibold shadow-sm transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary-600/70 hover:bg-primary-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                  Save changes
                </button>
              </div>
            )}
          </div>

          {/* Right Column (4 cols): Summary & Preview */}
          <div className="lg:col-span-4 space-y-6">
            {/* Your setup Card */}
            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-5 sm:p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Your setup</h3>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-surface-600 dark:text-surface-300">
                    <div className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <span>Email</span>
                  </div>
                  <span className="font-bold text-surface-900 dark:text-surface-100">
                    {emailTopicsActive} of 7 topics
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-surface-600 dark:text-surface-300">
                    <div className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-500">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    <span>Push</span>
                  </div>
                  <span className="font-bold text-surface-900 dark:text-surface-100">
                    {pushTopicsActive} of 7 topics
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-surface-600 dark:text-surface-300">
                    <div className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-surface-500">
                      <Moon className="w-3.5 h-3.5" />
                    </div>
                    <span>Quiet hours</span>
                  </div>
                  <span className="font-bold text-surface-900 dark:text-surface-100">
                    {quietHoursEnabled && localPrefs.quiet_hours_start && localPrefs.quiet_hours_end
                      ? `${formatTime12h(localPrefs.quiet_hours_start)} – ${formatTime12h(localPrefs.quiet_hours_end)}`
                      : 'Off'}
                  </span>
                </div>
              </div>
            </div>

            {/* Preview Card */}
            <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200/90 dark:border-surface-800 p-5 sm:p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">Preview</h3>

              {/* Notification sample box */}
              <div className="p-3.5 rounded-2xl border border-surface-200/80 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-950/40 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-primary-600 text-white shrink-0 mt-0.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-surface-900 dark:text-surface-100">Dues reminder</p>
                    <span className="text-[10px] text-surface-400">now</span>
                  </div>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-0.5 leading-relaxed">
                    Your departmental dues are due soon.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendTestNotification}
                disabled={testingNotification}
                className="w-full py-2.5 px-4 rounded-xl border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-950/30 text-primary-600 dark:text-primary-400 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                {testingNotification ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                Send a test notification
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
