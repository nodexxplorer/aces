import { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  Loader2,
  Search,
  BookOpen,
  Award,
  TrendingUp,
  Check,
  Layers,
  Download,
} from 'lucide-react';
import { getMyApprovedResults, type ApprovedResultDetail } from '../../api/cgpa';
import { getCourses } from '../../api/courses';
import { getMyRegisteredCourseIDs } from '../../api/course-registrations';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import type { Course } from '../../types';

interface ProjectedCourseRow {
  id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  unit: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  score?: number;
  isExistingResult?: boolean;
  actualGrade?: string;
  actualScore?: number;
}

const GRADE_POINTS: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = {
  A: 5.0,
  B: 4.0,
  C: 3.0,
  D: 2.0,
  E: 1.0,
  F: 0.0,
};

const GRADE_RANGES: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', string> = {
  A: '70–100%',
  B: '60–69%',
  C: '50–59%',
  D: '45–49%',
  E: '40–44%',
  F: '0–39%',
};

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}

function getDegreeClass(cgpa: number): { label: string; color: string; badgeBg: string } {
  if (cgpa >= 4.5) {
    return {
      label: 'First Class Honours',
      color: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    };
  }
  if (cgpa >= 3.5) {
    return {
      label: 'Second Class Upper (2:1)',
      color: 'text-[#1d68ec] dark:text-[#38bdf8]',
      badgeBg: 'bg-blue-500/10 text-[#1d68ec] dark:text-[#38bdf8] border-blue-500/30',
    };
  }
  if (cgpa >= 2.4) {
    return {
      label: 'Second Class Lower (2:2)',
      color: 'text-indigo-600 dark:text-indigo-400',
      badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    };
  }
  if (cgpa >= 1.5) {
    return {
      label: 'Third Class',
      color: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    };
  }
  return {
    label: 'Pass / At Risk',
    color: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  };
}

export default function WhatIfSimulatorTab() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [approvedResults, setApprovedResults] = useState<ApprovedResultDetail[]>([]);
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // User's interactive projected courses
  const [projectedCourses, setProjectedCourses] = useState<ProjectedCourseRow[]>([]);

  // Course selector filters
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all');
  const [semesterFilter, setSemesterFilter] = useState<'all' | 'first' | 'second'>('all');
  const [isSelectorOpen, setIsSelectorOpen] = useState(true);

  // Custom course manual input
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customUnit, setCustomUnit] = useState(3);
  const [customGrade, setCustomGrade] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F'>('A');

  // Load real data from backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.allSettled([getMyApprovedResults(), getCourses({ perPage: 100 }), getMyRegisteredCourseIDs()])
      .then(([resultsRes, coursesRes, regRes]) => {
        if (!isMounted) return;

        const results = resultsRes.status === 'fulfilled' ? resultsRes.value || [] : [];
        const courses = coursesRes.status === 'fulfilled' ? coursesRes.value || [] : [];
        const regIds = regRes.status === 'fulfilled' ? new Set(regRes.value || []) : new Set<string>();

        setApprovedResults(results);
        setCatalogCourses(courses);
        setRegisteredIds(regIds);

        // Pre-populate projection list:
        // 1. If student has approved results, prefill them
        // 2. If student has NO approved results but registered courses, prefill registered courses with default 'A'
        // 3. Otherwise if fresh student, preload current level courses
        const initialRows: ProjectedCourseRow[] = [];

        if (results.length > 0) {
          results.forEach((r) => {
            const validGrade = (
              ['A', 'B', 'C', 'D', 'E', 'F'].includes(r.grade?.toUpperCase())
                ? r.grade.toUpperCase()
                : scoreToGrade(r.score)
            ) as 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

            initialRows.push({
              id: `res-${r.course_id}`,
              course_id: r.course_id,
              course_code: r.course_code,
              course_title: r.course_title,
              unit: r.unit || 3,
              grade: validGrade,
              score: r.score,
              isExistingResult: true,
              actualGrade: r.grade,
              actualScore: r.score,
            });
          });
        } else if (regIds.size > 0 && courses.length > 0) {
          courses
            .filter((c) => regIds.has(c.id))
            .forEach((c) => {
              initialRows.push({
                id: `reg-${c.id}`,
                course_id: c.id,
                course_code: c.code,
                course_title: c.title,
                unit: c.creditUnits || c.unit || 3,
                grade: 'A',
                score: 75,
              });
            });
        } else if (courses.length > 0 && user?.level) {
          // Preload up to 5 courses matching the user's level
          courses
            .filter((c) => c.level === user.level)
            .slice(0, 5)
            .forEach((c) => {
              initialRows.push({
                id: `lvl-${c.id}`,
                course_id: c.id,
                course_code: c.code,
                course_title: c.title,
                unit: c.creditUnits || c.unit || 3,
                grade: 'A',
                score: 75,
              });
            });
        }

        setProjectedCourses(initialRows);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Set of already added course IDs
  const addedCourseIds = useMemo(() => {
    return new Set(projectedCourses.map((p) => p.course_id));
  }, [projectedCourses]);

  // Filtered catalog courses for the redesigned course selector
  const availableCatalogCourses = useMemo(() => {
    return catalogCourses.filter((course) => {
      if (levelFilter !== 'all' && course.level !== levelFilter) return false;
      if (semesterFilter !== 'all') {
        const sem = course.semester?.toLowerCase() || '';
        if (semesterFilter === 'first' && !sem.includes('1') && !sem.includes('first')) return false;
        if (semesterFilter === 'second' && !sem.includes('2') && !sem.includes('second')) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return course.code.toLowerCase().includes(q) || course.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [catalogCourses, levelFilter, semesterFilter, searchQuery]);

  // Add course to projection
  const handleAddCourse = (course: Course) => {
    if (addedCourseIds.has(course.id)) return;

    setProjectedCourses((prev) => [
      ...prev,
      {
        id: `proj-${course.id}-${Date.now()}`,
        course_id: course.id,
        course_code: course.code,
        course_title: course.title,
        unit: course.creditUnits || course.unit || 3,
        grade: 'A',
        score: 75,
      },
    ]);
    success('Added to Projection', `${course.code} added.`);
  };

  // Add custom unlisted course
  const handleAddCustomCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim() || !customTitle.trim()) {
      notifyError('Missing Fields', 'Please provide a course code and title.');
      return;
    }

    const pseudoId = `custom-${Date.now()}`;
    setProjectedCourses((prev) => [
      ...prev,
      {
        id: pseudoId,
        course_id: pseudoId,
        course_code: customCode.trim().toUpperCase(),
        course_title: customTitle.trim(),
        unit: Math.max(1, Number(customUnit) || 3),
        grade: customGrade,
      },
    ]);

    setCustomCode('');
    setCustomTitle('');
    setCustomUnit(3);
    setCustomGrade('A');
    setShowCustomModal(false);
    success('Course Added', 'Custom course added to your projection table.');
  };

  // Import all registered courses
  const handleImportRegistered = () => {
    if (registeredIds.size === 0) {
      notifyError('No Registrations', 'You do not have any registered courses for this semester.');
      return;
    }

    const newRows: ProjectedCourseRow[] = [];
    catalogCourses.forEach((c) => {
      if (registeredIds.has(c.id) && !addedCourseIds.has(c.id)) {
        newRows.push({
          id: `reg-${c.id}-${Date.now()}`,
          course_id: c.id,
          course_code: c.code,
          course_title: c.title,
          unit: c.creditUnits || c.unit || 3,
          grade: 'A',
          score: 75,
        });
      }
    });

    if (newRows.length === 0) {
      notifyError('Already Added', 'All your registered courses are already in your projection list.');
      return;
    }

    setProjectedCourses((prev) => [...prev, ...newRows]);
    success('Imported', `Added ${newRows.length} registered courses.`);
  };

  // Update target grade for a course
  const handleUpdateGrade = (id: string, grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F') => {
    setProjectedCourses((prev) => prev.map((c) => (c.id === id ? { ...c, grade } : c)));
  };

  // Update target score for a course
  const handleUpdateScore = (id: string, rawScore: string) => {
    const scoreVal = rawScore === '' ? undefined : Number(rawScore);
    setProjectedCourses((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const newGrade = scoreVal !== undefined ? scoreToGrade(scoreVal) : c.grade;
          return { ...c, score: scoreVal, grade: newGrade };
        }
        return c;
      }),
    );
  };

  // Remove a course from projection
  const handleRemoveCourse = (id: string) => {
    setProjectedCourses((prev) => prev.filter((c) => c.id !== id));
  };

  // Reset to initial
  const handleReset = () => {
    setProjectedCourses([]);
    success('Reset', 'Cleared all projected courses.');
  };

  // Calculation Metrics
  const metrics = useMemo(() => {
    const totalUnits = projectedCourses.reduce((sum, c) => sum + (c.unit || 0), 0);
    const totalPoints = projectedCourses.reduce((sum, c) => sum + (c.unit || 0) * (GRADE_POINTS[c.grade] ?? 0), 0);
    const projectedCgpa = totalUnits > 0 ? totalPoints / totalUnits : 0;

    // Past actual baseline (if results exist)
    const pastUnits = approvedResults.reduce((sum, r) => sum + (r.unit || 0), 0);
    const pastPoints = approvedResults.reduce((sum, r) => {
      const g = (
        ['A', 'B', 'C', 'D', 'E', 'F'].includes(r.grade?.toUpperCase()) ? r.grade.toUpperCase() : scoreToGrade(r.score)
      ) as 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
      return sum + (r.unit || 0) * (GRADE_POINTS[g] ?? 0);
    }, 0);
    const currentActualCgpa = pastUnits > 0 ? pastPoints / pastUnits : null;

    const diff = currentActualCgpa !== null ? projectedCgpa - currentActualCgpa : 0;

    return {
      totalUnits,
      totalPoints,
      projectedCgpa: Number(projectedCgpa.toFixed(2)),
      currentActualCgpa: currentActualCgpa !== null ? Number(currentActualCgpa.toFixed(2)) : null,
      diff: Number(diff.toFixed(2)),
      degreeClass: getDegreeClass(projectedCgpa),
    };
  }, [projectedCourses, approvedResults]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec]" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading course catalog & results...</p>
      </div>
    );
  }

  const hasNoResults = approvedResults.length === 0;

  return (
    <div className="space-y-8">
      {/* Hero / Instruction Banner */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-purple-600/10 border border-blue-500/20 dark:border-blue-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#1d68ec] text-white">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                {hasNoResults ? 'Fresh Student & Pre-Results CGPA Projection' : 'CGPA What-If Simulator'}
              </h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {hasNoResults
                ? 'No published results on record yet. Select your courses below, project your expected grades (A–F), and calculate your projected semester GPA and cumulative CGPA instantly.'
                : 'Simulate how your CGPA shifts by projecting upcoming semester grades alongside your approved past results.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {registeredIds.size > 0 && (
              <button
                onClick={handleImportRegistered}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 text-[#1d68ec] dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Import My Registered Courses ({registeredIds.size})
              </button>
            )}
            <button
              onClick={() => setShowCustomModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 dark:bg-[#1f222e] dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#282c3c] transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Custom Course
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Cards: Realtime Projected CGPA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Projected CGPA */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161820] border border-slate-200 dark:border-[#222530] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>PROJECTED CGPA</span>
            <Award className="w-4 h-4 text-[#1d68ec]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {metrics.projectedCgpa.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">/ 5.00</span>
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${metrics.degreeClass.badgeBg}`}
            >
              {metrics.degreeClass.label}
            </span>
          </div>
        </div>

        {/* Card 2: Current Actual CGPA (if any) or Degree Benchmark */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161820] border border-slate-200 dark:border-[#222530] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>{metrics.currentActualCgpa !== null ? 'CURRENT CGPA' : 'TARGET FIRST CLASS'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {metrics.currentActualCgpa !== null ? metrics.currentActualCgpa.toFixed(2) : '4.50'}
            </span>
            {metrics.currentActualCgpa !== null && (
              <span className={`text-xs font-bold ${metrics.diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {metrics.diff >= 0 ? `+${metrics.diff.toFixed(2)}` : metrics.diff.toFixed(2)}
              </span>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            {metrics.currentActualCgpa !== null
              ? 'Based on approved published transcripts'
              : 'Minimum CGPA threshold for 1st Class Honours'}
          </p>
        </div>

        {/* Card 3: Total Projected Units */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161820] border border-slate-200 dark:border-[#222530] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>TOTAL CREDIT UNITS (TNU)</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {metrics.totalUnits}
            </span>
            <span className="text-xs text-slate-400">Units</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            {projectedCourses.length} courses in active projection
          </p>
        </div>

        {/* Card 4: Total Quality Points */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#161820] border border-slate-200 dark:border-[#222530] shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>TOTAL GRADE POINTS (TCP)</span>
            <Layers className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {metrics.totalPoints.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">Points</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Sum of (Units × Grade Points)</p>
        </div>
      </div>

      {/* Projection Table */}
      <div className="bg-white dark:bg-[#161820] rounded-2xl border border-slate-200 dark:border-[#222530] shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 dark:border-[#222530] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Course Projection List ({projectedCourses.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Change the target grade or numerical score to observe the instant impact on your CGPA.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {projectedCourses.length > 0 && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
            <button
              onClick={() => setIsSelectorOpen(!isSelectorOpen)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1d68ec] text-white hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSelectorOpen ? 'Hide Course Catalog' : '+ Add More Courses'}
            </button>
          </div>
        </div>

        {projectedCourses.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#1d68ec] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">No Courses in Your Projection</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Pick courses from the catalog below, import your registered courses, or add a custom course to calculate
              your projected CGPA.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-[#13151b] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-100 dark:border-[#222530]">
                  <th className="py-3.5 px-4">Course</th>
                  <th className="py-3.5 px-4 text-center">Units</th>
                  <th className="py-3.5 px-4">Projected Grade</th>
                  <th className="py-3.5 px-4 text-center">Score (0–100)</th>
                  <th className="py-3.5 px-4 text-center">Grade Point</th>
                  <th className="py-3.5 px-4 text-center">Quality Pts</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#222530]">
                {projectedCourses.map((c) => {
                  const pts = GRADE_POINTS[c.grade] ?? 0;
                  const qualityPts = (c.unit * pts).toFixed(1);

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-[#1a1d26]/50 transition-colors">
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{c.course_code}</span>
                          {c.isExistingResult && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Approved
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                          {c.course_title}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {c.unit}
                      </td>

                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((gradeOpt) => (
                            <button
                              key={gradeOpt}
                              type="button"
                              onClick={() => handleUpdateGrade(c.id, gradeOpt)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                c.grade === gradeOpt
                                  ? 'bg-[#1d68ec] text-white shadow-sm ring-2 ring-blue-500/30 scale-105'
                                  : 'bg-slate-100 text-slate-600 dark:bg-[#20232e] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2b2f3f]'
                              }`}
                            >
                              {gradeOpt}
                            </button>
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">{GRADE_RANGES[c.grade]}</span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder={c.score !== undefined ? String(c.score) : '—'}
                          value={c.score !== undefined ? c.score : ''}
                          onChange={(e) => handleUpdateScore(c.id, e.target.value)}
                          className="w-16 text-center px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#2a2e3d] bg-white dark:bg-[#12141a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {pts.toFixed(1)}
                      </td>

                      <td className="py-3.5 px-4 text-center font-extrabold text-[#1d68ec] dark:text-[#38bdf8]">
                        {qualityPts}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleRemoveCourse(c.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          title="Remove from projection"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Redesigned Course Selector Section */}
      {isSelectorOpen && (
        <div className="bg-white dark:bg-[#161820] rounded-2xl border border-slate-200 dark:border-[#222530] shadow-sm p-5 md:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1d68ec]" />
                Course Catalog Selector
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Browse or search courses to add them directly into your CGPA projection.
              </p>
            </div>

            {/* Quick Level Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-400 mr-1">Level:</span>
              {(['all', 100, 200, 300, 400, 500] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    levelFilter === lvl
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 dark:bg-[#1f222e] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#282c3c]'
                  }`}
                >
                  {lvl === 'all' ? 'All Levels' : `${lvl}L`}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar & Semester filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search course code or title (e.g. CPE 311, Data Structures)..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#262936] bg-slate-50 dark:bg-[#13151b] text-xs md:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
              {(['all', 'first', 'second'] as const).map((sem) => (
                <button
                  key={sem}
                  onClick={() => setSemesterFilter(sem)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                    semesterFilter === sem
                      ? 'bg-[#1d68ec] text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-[#1f222e] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#282c3c]'
                  }`}
                >
                  {sem === 'all' ? 'All Semesters' : `${sem} Semester`}
                </button>
              ))}
            </div>
          </div>

          {/* Course Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[460px] overflow-y-auto pr-1">
            {availableCatalogCourses.map((course) => {
              const isAdded = addedCourseIds.has(course.id);
              const isRegistered = registeredIds.has(course.id);

              return (
                <div
                  key={course.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    isAdded
                      ? 'border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/10'
                      : 'border-slate-200 dark:border-[#242733] bg-white dark:bg-[#14161d] hover:border-blue-400 dark:hover:border-blue-600'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{course.code}</span>
                      <div className="flex items-center gap-1">
                        {isRegistered && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                            Registered
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-[#20232e] text-slate-700 dark:text-slate-300">
                          {course.creditUnits || course.unit || 3} Units
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1">
                      {course.title}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                      <span>{course.level} Level</span>
                      <span>&middot;</span>
                      <span className="capitalize">{course.semester || '1st'} Sem</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddCourse(course)}
                    disabled={isAdded}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isAdded
                        ? 'bg-blue-500/10 text-[#1d68ec] dark:text-[#38bdf8] cursor-default'
                        : 'bg-[#1d68ec] text-white hover:bg-blue-600'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added to Projection</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Projection</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {availableCatalogCourses.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400">
              No courses found matching the search criteria.
            </div>
          )}
        </div>
      )}

      {/* Manual Custom Course Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#161820] w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#222530] shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Custom Course</h3>
              <button onClick={() => setShowCustomModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomCourse} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Course Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. MEE 201"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#262936] bg-slate-50 dark:bg-[#13151b] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engineering Mechanics"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#262936] bg-slate-50 dark:bg-[#13151b] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Credit Units
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={customUnit}
                    onChange={(e) => setCustomUnit(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#262936] bg-slate-50 dark:bg-[#13151b] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Target Grade
                  </label>
                  <select
                    value={customGrade}
                    onChange={(e) => setCustomGrade(e.target.value as 'A' | 'B' | 'C' | 'D' | 'E' | 'F')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#262936] bg-slate-50 dark:bg-[#13151b] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="A">A (5.0 Points)</option>
                    <option value="B">B (4.0 Points)</option>
                    <option value="C">C (3.0 Points)</option>
                    <option value="D">D (2.0 Points)</option>
                    <option value="E">E (1.0 Points)</option>
                    <option value="F">F (0.0 Points)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1d68ec] text-white hover:bg-blue-600 transition-colors"
                >
                  Add Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
