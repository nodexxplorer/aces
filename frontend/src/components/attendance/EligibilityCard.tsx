import Card from '../ui/Card';
import Badge, { type BadgeVariant } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { CheckCircle, XCircle, Clock, HelpCircle } from 'lucide-react';

interface EligibilityCardProps {
  credited: number;
  total: number;
  pending: number;
  decision: string;
  percentage: number | null;
}

const decisionMeta: Record<string, { label: string; variant: BadgeVariant; icon: typeof CheckCircle }> = {
  eligible: { label: 'Eligible for examination', variant: 'success', icon: CheckCircle },
  not_eligible: { label: 'Not eligible', variant: 'danger', icon: XCircle },
  pending_review: { label: 'Pending review', variant: 'warning', icon: Clock },
  not_assessable: { label: 'Not yet assessable', variant: 'default', icon: HelpCircle },
};

export default function EligibilityCard({ credited, total, pending, decision, percentage }: EligibilityCardProps) {
  const meta = decisionMeta[decision] || decisionMeta.not_assessable;
  const Icon = meta.icon;
  const pct = percentage ?? 0;
  const barColor =
    decision === 'eligible'
      ? 'bg-success-500'
      : decision === 'not_eligible'
        ? 'bg-danger-500'
        : decision === 'pending_review'
          ? 'bg-warning-500'
          : 'bg-surface-400';

  return (
    <Card className="overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-3xl font-bold tracking-tight">
              {percentage !== null ? `${percentage.toFixed(1)}%` : '—'}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              {credited} / {total} sessions credited
              {pending > 0 && <span className="text-warning-600 dark:text-warning-400"> · {pending} unresolved</span>}
            </p>
          </div>
          <Badge variant={meta.variant} className="text-sm gap-1.5 px-3 py-1">
            <Icon className="w-3.5 h-3.5" />
            {meta.label}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400">
            <span>Attendance</span>
            <span>75% threshold</span>
          </div>
          <div className="relative h-3 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', barColor)}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
            {/* Threshold marker */}
            <div className="absolute inset-y-0 left-[75%] w-0.5 bg-surface-400 dark:bg-surface-500" />
          </div>
        </div>

        <p className="text-xs text-surface-400 dark:text-surface-500">
          Policy: pilot-session-75-v1 · Late attendance receives full credit · Decisions use exact ratios, not rounded
          display percentages.
        </p>
      </div>
    </Card>
  );
}
