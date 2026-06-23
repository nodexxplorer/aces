import Badge from '../ui/Badge';

const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  active: 'success', pending: 'warning', rejected: 'danger', completed: 'success',
  processing: 'info', open: 'info', closed: 'default', in_progress: 'warning',
  resolved: 'success', failed: 'danger', blocked: 'danger', suspended: 'danger',
};

const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={variants[status] || 'default'} dot>{status.replace(/_/g, ' ')}</Badge>
);

export default StatusBadge;
