import { useAlumniStore } from '../stores/alumniStore';
import { useAuthStore } from '../stores/authStore';
import { checkAlumniEligibility } from '../utils/alumni-check';

export const useAlumniStatus = () => {
  const alumni = useAlumniStore();
  const user = useAuthStore((s) => s.user);

  const status = alumni.status as {
    graduation_year?: number;
    has_carryover?: boolean;
    dues_cleared?: boolean;
  };

  const eligibility = checkAlumniEligibility(
    status?.graduation_year ? 5 : 3,
    status?.has_carryover ?? false,
    status?.dues_cleared ?? false
  );

  const isAlumni = user?.roles.includes('alumni') ?? false;

  return { ...alumni, eligibility, isAlumni };
};
