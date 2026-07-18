import { useState, useCallback } from 'react';
import type { Result } from '../types';
import { calculateGPA, getClassOfDegree, scoreToGrade, gradeToPoints } from '../utils/cgpa';

interface CGPAEntry {
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  score: number;
}

export const useCGPACalculator = () => {
  const [entries, setEntries] = useState<CGPAEntry[]>([]);

  const addEntry = useCallback((entry: CGPAEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  const removeEntry = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearEntries = useCallback(() => setEntries([]), []);

  const results: Result[] = entries.map((e, i) => ({
    id: `calc-${i}`,
    studentId: '',
    courseId: '',
    sessionId: '',
    semester: 'harmattan',
    caScore: 0,
    examScore: e.score,
    totalScore: e.score,
    grade: scoreToGrade(e.score),
    gradePoints: gradeToPoints(scoreToGrade(e.score)),
    isApproved: true,
    createdAt: '',
    course: {
      id: `c-${i}`,
      code: e.courseCode,
      title: e.courseTitle,
      unit: e.creditUnits,
      creditUnits: e.creditUnits,
      level: 1,
      semester: 'harmattan',
      courseType: 'core',
      subcategory: 'core',
      department: '',
      isActive: true,
      createdAt: '',
    },
  }));

  const gpa = calculateGPA(results);
  const classOfDegree = getClassOfDegree(gpa);

  return { entries, addEntry, removeEntry, clearEntries, gpa, classOfDegree };
};
