export const calculateReputationScore = (
  completedTrades: number,
  averageRating: number
): number => Math.round(completedTrades * averageRating * 10);

export const getReputationBadge = (score: number): { label: string; color: string } => {
  if (score >= 200) return { label: 'Top Trader', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
  if (score >= 100) return { label: 'Reliable', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
  if (score >= 50) return { label: 'Active', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  return { label: 'New', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
};

export const matchTradeSkills = (
  userSkills: string[],
  targetNeeds: string[]
): number => {
  const matches = userSkills.filter((s) => targetNeeds.includes(s)).length;
  return targetNeeds.length === 0 ? 0 : (matches / targetNeeds.length) * 100;
};
