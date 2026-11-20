import { useState } from 'react';
import Badge from '../ui/Badge';
import { ChevronDown, ChevronRight, Clock, Shield } from 'lucide-react';
import type { AttendanceEvent } from '../../api/verified-attendance';

interface AuditTimelineProps {
  events: AttendanceEvent[];
}

const actionColors: Record<string, string> = {
  created: 'bg-primary-500',
  open: 'bg-success-500',
  close: 'bg-warning-500',
  finalize: 'bg-primary-500',
  cancel: 'bg-danger-500',
  checkin: 'bg-success-400',
  record_review: 'bg-accent-500',
  dispute_opened: 'bg-warning-400',
  delegate: 'bg-surface-400',
};

const label = (s: string) => s.replace(/_/g, ' ');

export default function AuditTimeline({ events }: AuditTimelineProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (events.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-surface-700 dark:text-surface-300">
        <Shield className="w-4 h-4" />
        Audit Trail
      </div>

      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-surface-200 dark:bg-surface-700" />

        {events.map((event) => (
          <div key={event.id} className="relative pb-4 last:pb-0">
            {/* Dot */}
            <div
              className={`absolute left-[-15px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-surface-800 ${actionColors[event.action] || 'bg-surface-400'}`}
            />

            <div className="ml-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">
                  {label(event.action)}
                </Badge>
                <span className="text-xs text-surface-400 dark:text-surface-500 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>

              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [event.id]: !prev[event.id] }))}
                className="mt-1 text-xs text-surface-500 dark:text-surface-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1"
              >
                {expanded[event.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {expanded[event.id] ? 'Hide details' : 'View evidence'}
              </button>

              {expanded[event.id] && (
                <pre className="mt-1 text-xs bg-surface-50 dark:bg-surface-700/50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-surface-600 dark:text-surface-400">
                  {JSON.stringify(event.evidence, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-surface-400 dark:text-surface-500 mt-2 flex items-center gap-1">
        <Shield className="w-3 h-3" />
        Append-only — these records cannot be modified or deleted.
      </p>
    </div>
  );
}
