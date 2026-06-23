import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ApprovalGateProps {
  children: ReactNode;
  /** Roles that bypass the approval requirement (e.g. hod, delegated_admin) */
  bypassRoles?: string[];
}

const ApprovalGate = ({ children, bypassRoles = ['hod', 'delegated_admin'] }: ApprovalGateProps) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const activeRole = user.activeRole as string;
  if (bypassRoles.includes(activeRole)) return <>{children}</>;

  if (user.approvalStatus === 'rejected') return <Navigate to="/approval-rejected" replace />;

  return <>{children}</>;
};

export default ApprovalGate;
