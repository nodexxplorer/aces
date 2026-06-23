import Badge from '../ui/Badge';
import type { ApprovalStatus } from '../../types';

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
}

const colors: Record<ApprovalStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const labels: Record<ApprovalStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const ApprovalStatusBadge = ({ status }: ApprovalStatusBadgeProps) => (
  <Badge variant={colors[status]} dot>
    {labels[status]}
  </Badge>
);

export default ApprovalStatusBadge;
