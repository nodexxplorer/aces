import { cn } from '../../utils/cn';
import type { Result } from '../../types';
import GradeBadge from './GradeBadge';

interface ResultRowProps {
  result: Result;
  className?: string;
}

const ResultRow = ({ result, className }: ResultRowProps) => (
  <tr className={cn('border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors', className)}>
    <td className="px-4 py-3 text-sm font-medium text-surface-900 dark:text-surface-100">{result.course?.code ?? '-'}</td>
    <td className="px-4 py-3 text-sm text-surface-700 dark:text-surface-300">{result.course?.title ?? '-'}</td>
    <td className="px-4 py-3 text-sm text-center">{result.caScore}</td>
    <td className="px-4 py-3 text-sm text-center">{result.examScore}</td>
    <td className="px-4 py-3 text-sm text-center font-semibold">{result.totalScore}</td>
    <td className="px-4 py-3 text-center"><GradeBadge grade={result.grade} /></td>
  </tr>
);

export default ResultRow;
