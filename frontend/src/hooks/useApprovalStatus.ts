import { useAuthStore } from '../stores/authStore';

export const useApprovalStatus = () => {
  const user = useAuthStore((s) => s.user);
  const isApproved = user?.isApproved ?? false;
  const isPending = user?.approvalStatus === 'pending';
  const isRejected = user?.approvalStatus === 'rejected';
  return { isApproved, isPending, isRejected, approvalStatus: user?.approvalStatus };
};
