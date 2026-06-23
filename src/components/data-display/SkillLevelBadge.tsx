import { cn } from '../../utils/cn';
import type { SkillLevel } from '../../types';

const map: Record<SkillLevel, { label: string; cls: string }> = {
  beginner:     { label: 'Beginner',     cls: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-300' },
  intermediate: { label: 'Intermediate', cls: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' },
  expert:       { label: 'Expert',       cls: 'bg-accent-100  text-accent-700  dark:bg-accent-900/30  dark:text-accent-400'  },
};

interface SkillLevelBadgeProps { level: SkillLevel; className?: string }

const SkillLevelBadge = ({ level, className }: SkillLevelBadgeProps) => {
  const { label, cls } = map[level] ?? { label: level, cls: 'bg-surface-100 text-surface-600' };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', cls, className)}>
      {label}
    </span>
  );
};

export default SkillLevelBadge;
