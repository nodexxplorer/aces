import { GraduationCap, CheckCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

interface AlumniBadgeProps { isVerified?: boolean; className?: string; }

const AlumniBadge = ({ isVerified, className }: AlumniBadgeProps) => (
  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', className)}>
    <GraduationCap className="w-3 h-3" />
    Alumni
    {isVerified && <CheckCircle className="w-3 h-3 text-emerald-500" />}
  </span>
);

export default AlumniBadge;
