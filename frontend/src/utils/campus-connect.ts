export const calculateConnectionScore = (
  sharedCourses: number,
  complementarySkills: number,
  sameLevel: boolean
): number => {
  let score = 0;
  score += sharedCourses * 20;
  score += complementarySkills * 30;
  if (sameLevel) score += 15;
  return Math.min(score, 100);
};

export const getConnectionStrength = (score: number): { label: string; color: string } => {
  if (score >= 80) return { label: 'Strong Match', color: 'text-emerald-600' };
  if (score >= 50) return { label: 'Good Match', color: 'text-blue-600' };
  if (score >= 25) return { label: 'Potential', color: 'text-amber-600' };
  return { label: 'Discover', color: 'text-gray-500' };
};
