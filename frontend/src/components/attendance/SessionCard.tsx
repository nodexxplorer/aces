import { useState, useEffect } from 'react';

import { cn } from '../../utils/cn';
import { Calendar, MapPin, Users, Clock, Radio, AlertCircle } from 'lucide-react';
import type { VerifiedSession } from '../../api/verified-attendance';

interface SessionCardProps {
  session: VerifiedSession;
  onClick: () => void;
  active?: boolean;
  stats?: { checkedIn: number; total: number; flagged: number; disputes: number };
}

const statusConfig: Record<
  string,
  {
    dot: string;
    label: string;
    variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
    border: string;
    bgBadge: string;
  }
> = {
  draft: {
    dot: 'bg-slate-400 dark:bg-slate-500',
    label: 'Draft',
    variant: 'default',
    border: 'border-l-slate-400',
    bgBadge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  open: {
    dot: 'bg-emerald-500 animate-ping',
    label: 'Live Check-in',
    variant: 'success',
    border: 'border-l-emerald-500 ring-1 ring-emerald-500/20',
    bgBadge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  closed: {
    dot: 'bg-amber-500',
    label: 'Closed',
    variant: 'warning',
    border: 'border-l-amber-500',
    bgBadge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
  finalized: {
    dot: 'bg-blue-500',
    label: 'Finalized',
    variant: 'info',
    border: 'border-l-blue-500',
    bgBadge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  },
  cancelled: {
    dot: 'bg-rose-500',
    label: 'Cancelled',
    variant: 'danger',
    border: 'border-l-rose-500',
    bgBadge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  },
};

export default function SessionCard({ session, onClick, active, stats }: SessionCardProps) {
  const config = statusConfig[session.status] || statusConfig.draft;
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Live countdown for open sessions
  useEffect(() => {
    if (session.status !== 'open' || !session.closes_at) {
      setSecondsRemaining(null);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((new Date(session.closes_at!).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [session.status, session.closes_at]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const scheduledDate = new Date(session.scheduled_at);
  const formattedDate = scheduledDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = scheduledDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border border-l-4 p-4 transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden',
        config.border,
        active
          ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20 shadow-md ring-1 ring-primary-500/30'
          : 'border-surface-200 dark:border-surface-700/60 bg-white dark:bg-[#1a1d21]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="relative mt-1 shrink-0 flex items-center justify-center">
            {session.status === 'open' && (
              <span className="absolute h-3 w-3 rounded-full bg-emerald-400 opacity-75 animate-ping" />
            )}
            <span className={cn('h-2.5 w-2.5 rounded-full relative', config.dot)} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-bold text-surface-900 dark:text-surface-100 truncate text-sm">{session.title}</p>
              {session.status === 'open' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 animate-pulse">
                  <Radio className="w-2.5 h-2.5" /> LIVE
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-surface-500 dark:text-surface-400">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate} · {formattedTime}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {session.venue}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {session.duration_minutes}m window
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              config.bgBadge,
            )}
          >
            {config.label}
          </span>
          {secondsRemaining !== null && secondsRemaining > 0 && (
            <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
              Closes in {formatTimer(secondsRemaining)}
            </span>
          )}
        </div>
      </div>

      {stats && stats.total > 0 && (
        <div className="mt-3 pt-2.5 border-t border-surface-100 dark:border-surface-700/50">
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400 mb-1">
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {stats.checkedIn}/{stats.total} checked in
            </span>
            <span className="font-semibold text-surface-700 dark:text-surface-300">
              {Math.round((stats.checkedIn / stats.total) * 100)}%
            </span>
          </div>
          <div className="w-full bg-surface-100 dark:bg-surface-700/50 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                session.status === 'open' ? 'bg-emerald-500' : 'bg-primary-500',
              )}
              style={{ width: `${Math.min(100, Math.round((stats.checkedIn / stats.total) * 100))}%` }}
            />
          </div>
          {stats.flagged > 0 && (
            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              <AlertCircle className="w-3 h-3" />
              <span>
                {stats.flagged} flagged record{stats.flagged === 1 ? '' : 's'} need review
              </span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}
