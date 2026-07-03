import Badge from '../ui/Badge';
import type { Grade } from '../../types';

const gradeVariants: Record<Grade, 'success' | 'primary' | 'info' | 'warning' | 'danger'> = {
  A: 'success', B: 'primary', C: 'info', D: 'warning', E: 'warning', F: 'danger',
};

const GradeBadge = ({ grade }: { grade: Grade }) => (
  <Badge variant={gradeVariants[grade]}>{grade}</Badge>
);

export default GradeBadge;
