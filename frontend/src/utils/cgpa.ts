import type { Grade, Result } from '../types';
import { GRADE_POINTS } from './constants';

export const scoreToGrade = (score: number): Grade => {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D';
  if (score >= 40) return 'E';
  return 'F';
};

export const calculateGrade = scoreToGrade;

export const gradeToPoints = (grade: Grade): number => GRADE_POINTS[grade] ?? 0;

export const calculateGPA = (results: Result[]): number => {
  if (results.length === 0) return 0;
  let totalCredits = 0;
  let totalGradePoints = 0;
  for (const r of results) {
    const cu = r.course?.creditUnits ?? 0;
    totalCredits += cu;
    totalGradePoints += gradeToPoints(r.grade) * cu;
  }
  return totalCredits === 0 ? 0 : totalGradePoints / totalCredits;
};

export const calculateCGPA = (allResults: Result[][]): number => {
  let totalCredits = 0;
  let totalGradePoints = 0;
  for (const semester of allResults) {
    for (const r of semester) {
      const cu = r.course?.creditUnits ?? 0;
      totalCredits += cu;
      totalGradePoints += gradeToPoints(r.grade) * cu;
    }
  }
  return totalCredits === 0 ? 0 : totalGradePoints / totalCredits;
};

export const getClassOfDegree = (cgpa: number): string => {
  if (cgpa >= 4.5) return 'First Class Honours';
  if (cgpa >= 3.5) return 'Second Class Upper';
  if (cgpa >= 2.5) return 'Second Class Lower';
  if (cgpa >= 1.5) return 'Third Class';
  if (cgpa >= 1.0) return 'Pass';
  return 'Fail';
};

export const getGPAColor = (gpa: number): string => {
  if (gpa >= 4.5) return 'text-emerald-600 dark:text-emerald-400';
  if (gpa >= 3.5) return 'text-blue-600 dark:text-blue-400';
  if (gpa >= 2.5) return 'text-amber-600 dark:text-amber-400';
  if (gpa >= 1.5) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};
