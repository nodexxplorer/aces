import type { Grade } from '../types';
import { scoreToGrade, gradeToPoints } from './cgpa';

export const calculateTotalScore = (ca: number, exam: number): number => ca + exam;

export const getGradeFromScore = (total: number): { grade: Grade; points: number } => {
  const grade = scoreToGrade(total);
  return { grade, points: gradeToPoints(grade) };
};

export const isPassingGrade = (grade: Grade): boolean => grade !== 'F';

export const getGradeColor = (grade: Grade): string => {
  const colors: Record<Grade, string> = {
    A: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
    B: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
    C: 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/20',
    D: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
    E: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20',
    F: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
  };
  return colors[grade];
};
