export const checkAlumniEligibility = (
  level: number,
  hasCarryover: boolean,
  duesCleared: boolean
): { eligible: boolean; status: string; message: string } => {
  if (level < 5) {
    return { eligible: false, status: 'student', message: 'You must complete Year 5 to be eligible for alumni status.' };
  }
  if (hasCarryover) {
    return { eligible: false, status: 'pending', message: 'Complete your carryover courses to become an Alumni.' };
  }
  if (!duesCleared) {
    return { eligible: false, status: 'partial', message: 'Clear all pending dues for full alumni access. Networking only available.' };
  }
  return { eligible: true, status: 'active', message: 'Congratulations! You are eligible for full Alumni status.' };
};

export const getAlumniAccessLevel = (
  hasCarryover: boolean,
  duesCleared: boolean
): 'full' | 'networking_only' | 'blocked' => {
  if (hasCarryover) return 'blocked';
  if (!duesCleared) return 'networking_only';
  return 'full';
};
