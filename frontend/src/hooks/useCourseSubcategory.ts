import type { CourseSubcategory } from '../types';

const SUBCATEGORY_INFO: Record<CourseSubcategory, { label: string; color: string }> = {
  core: { label: 'Core', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  elective: { label: 'Elective', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  general: { label: 'General', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  practical: { label: 'Practical', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
};

export const useCourseSubcategory = () => {
  const getInfo = (sub: CourseSubcategory) => SUBCATEGORY_INFO[sub];
  const allSubcategories = Object.entries(SUBCATEGORY_INFO).map(([value, info]) => ({ value, ...info }));
  return { getInfo, allSubcategories };
};
