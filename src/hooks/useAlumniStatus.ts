import { useAlumniStore } from '../stores/alumniStore';
import { useAuthStore } from '../stores/authStore';
import { checkAlumniEligibility } from '../utils/alumni-check';

export const useAlumniStatus = () => {
  const alumni = useAlumniStore();
  const user = useAuthStore((s) => s.user);

  const eligibility = checkAlumniEligibility(
    alumni.status?.graduationYear ? 5 : 3,
    alumni.status?.hasCarryover ?? false,
    alumni.status?.duesCleared ?? false
  );

  const isAlumni = user?.roles.includes('alumni') ?? false;

  return { ...alumni, eligibility, isAlumni };
};
