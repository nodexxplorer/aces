import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Check, Plus, Minus, X, RotateCcw, Sparkles, Calculator } from 'lucide-react';
import { getCourses } from '../../api/courses';
import { getMyApprovedResults, type ApprovedResultDetail } from '../../api/cgpa';
import type { Course } from '../../types';

interface SelectedCourse {
  id: string;
  code: string;
  title: string;
  units: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
}

const GRADE_POINTS: Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F', number> = {
  A: 5.0,
  B: 4.0,
  C: 3.0,
  D: 2.0,
  E: 1.0,
  F: 0.0,
};

const GRADE_SCALE = [
  { grade: 'A', range: '70–100', point: '5.0' },
  { grade: 'B', range: '60–69', point: '4.0' },
  { grade: 'C', range: '50–59', point: '3.0' },
  { grade: 'D', range: '45–49', point: '2.0' },
  { grade: 'E', range: '40–44', point: '1.0' },
  { grade: 'F', range: '0–39', point: '0.0' },
];

const CLASSIFICATIONS = [
  { label: 'First Class', min: 4.5, max: 5.0, range: '4.50 – 5.00' },
  { label: 'Second Class Upper', min: 3.5, max: 4.49, range: '3.50 – 4.49' },
  { label: 'Second Class Lower', min: 2.4, max: 3.49, range: '2.40 – 3.49' },
  { label: 'Third Class', min: 1.5, max: 2.39, range: '1.50 – 2.39' },
  { label: 'Pass', min: 1.0, max: 1.49, range: '1.00 – 1.49' },
];

/**
 * Semi-circular half-donut gauge matching the design mockup.
 */
function CGPAGauge({ value }: { value: number }) {
  const radius = 80;
  const strokeWidth = 14;
  const circumference = Math.PI * radius;
  const percentage = Math.min(Math.max((value / 5.0) * 100, 0), 100);
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  return (
    <div className="relative flex flex-col items-center justify-center pt-2">
      <svg width="210" height="115" viewBox="0 0 210 115" className="overflow-visible">
        {/* Track arc */}
        <path
          d="M 25 110 A 80 80 0 0 1 185 110"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-slate-200 dark:text-[#252830]"
        />
        {/* Filled progress arc */}
        <path
          d="M 25 110 A 80 80 0 0 1 185 110"
          fill="none"
          stroke="#1d68ec"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute bottom-1 flex flex-col items-center">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {value.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function GPAHubPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [approvedResults, setApprovedResults] = useState<ApprovedResultDetail[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<SelectedCourse[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch real catalogue courses and student's approved results
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCourses({ perPage: 100 }).catch(() => [] as Course[]),
      getMyApprovedResults().catch(() => [] as ApprovedResultDetail[]),
    ])
      .then(([courseList, results]) => {
        setCourses(courseList);
        setApprovedResults(results);
      })
      .finally(() => setLoading(false));
  }, []);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute course prefix groups dynamically (e.g. CPE, GET, GST, MTH, PHY, STA, ENT)
  const prefixGroups = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of courses) {
      const match = c.code.match(/^[A-Za-z]+/);
      const prefix = match ? match[0].toUpperCase() : 'OTHER';
      map[prefix] = (map[prefix] || 0) + 1;
    }
    return map;
  }, [courses]);

  // Filter courses by search query and selected prefix
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (selectedPrefix === 'All') return true;
      const match = c.code.match(/^[A-Za-z]+/);
      const prefix = match ? match[0].toUpperCase() : 'OTHER';
      return prefix === selectedPrefix;
    });
  }, [courses, searchQuery, selectedPrefix]);

  // Current CGPA calculated from approved results
  const { currentCGPA, approvedUnits, approvedPoints } = useMemo(() => {
    if (!approvedResults || approvedResults.length === 0) {
      return { currentCGPA: 0, approvedUnits: 0, approvedPoints: 0 };
    }
    let units = 0;
    let points = 0;
    for (const r of approvedResults) {
      units += r.unit;
      points += r.unit * (r.grade_point || GRADE_POINTS[r.grade as keyof typeof GRADE_POINTS] || 0);
    }
    return {
      currentCGPA: units > 0 ? points / units : 0,
      approvedUnits: units,
      approvedPoints: points,
    };
  }, [approvedResults]);

  // Calculations for selected courses
  const { totalSelectedUnits, totalQualityPoints, projectedCGPA, activeClassification } = useMemo(() => {
    const totalSelectedUnits = selectedCourses.reduce((sum, c) => sum + (c.units || 0), 0);
    const totalQualityPoints = selectedCourses.reduce(
      (sum, c) => sum + (c.units || 0) * (GRADE_POINTS[c.grade] ?? 0),
      0,
    );

    let projected = 0;
    if (approvedUnits > 0) {
      const totalUnits = approvedUnits + totalSelectedUnits;
      const totalPoints = approvedPoints + totalQualityPoints;
      projected = totalUnits > 0 ? totalPoints / totalUnits : 0;
    } else {
      projected = totalSelectedUnits > 0 ? totalQualityPoints / totalSelectedUnits : 0;
    }

    let activeClassification: (typeof CLASSIFICATIONS)[number] | null = null;
    if (selectedCourses.length > 0 || approvedUnits > 0) {
      activeClassification = CLASSIFICATIONS.find((c) => projected >= c.min && projected <= c.max) || null;
    }

    return {
      totalSelectedUnits,
      totalQualityPoints,
      projectedCGPA: projected,
      activeClassification,
    };
  }, [selectedCourses, approvedUnits, approvedPoints]);

  const handleToggleCourse = (course: Course) => {
    const existing = selectedCourses.find((c) => c.id === course.id);
    if (existing) {
      setSelectedCourses((prev) => prev.filter((c) => c.id !== course.id));
    } else {
      setSelectedCourses((prev) => [
        ...prev,
        {
          id: course.id,
          code: course.code,
          title: course.title,
          units: course.creditUnits || course.unit || 2,
          grade: 'A',
        },
      ]);
    }
  };

  const handleUpdateGrade = (id: string, grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F') => {
    setSelectedCourses((prev) => prev.map((c) => (c.id === id ? { ...c, grade } : c)));
  };

  const handleAdjustUnits = (id: string, delta: number) => {
    setSelectedCourses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = Math.max(1, Math.min(6, c.units + delta));
        return { ...c, units: next };
      }),
    );
  };

  const handleRemoveSelected = (id: string) => {
    setSelectedCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleReset = () => {
    setSelectedCourses([]);
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 transition-colors pb-16">
      {/* ────────────────── PAGE HEADER ────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">GPA Tools</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Pick courses, choose expected grades and see your projected CGPA.
        </p>
      </div>

      {/* ────────────────── MAIN 2-COLUMN GRID ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ══════════════ LEFT COLUMN: PICK COURSES & SELECTION (7 cols) ══════════════ */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* ── CARD 1: Pick your courses ── */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Pick your courses</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{courses.length} courses</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Add the courses you want to include in your projection
            </p>

            {/* Search Input */}
            <div className="relative flex items-center mb-4">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by course code or title"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-[#15171c] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#1d68ec] transition-colors"
              />
              <kbd className="absolute right-3 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#20232b] text-[10px] text-slate-400 select-none">
                /
              </kbd>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedPrefix('All')}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedPrefix === 'All'
                    ? 'bg-[#1d68ec] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-[#20232b] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All <span className="text-[10px] opacity-80">{courses.length}</span>
              </button>

              {Object.entries(prefixGroups).map(([prefix, count]) => (
                <button
                  key={prefix}
                  type="button"
                  onClick={() => setSelectedPrefix(prefix)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                    selectedPrefix === prefix
                      ? 'bg-[#1d68ec] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-[#20232b] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {prefix} <span className="text-[10px] opacity-80">{count}</span>
                </button>
              ))}
            </div>

            {/* Course List */}
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading courses catalogue...</div>
              ) : filteredCourses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No courses matching your filter.</div>
              ) : (
                filteredCourses.map((c) => {
                  const isSelected = selectedCourses.some((sc) => sc.id === c.id);
                  const units = c.creditUnits || c.unit || 2;

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleToggleCourse(c)}
                      className="pt-2 pb-2 first:pt-0 flex items-center justify-between gap-3 cursor-pointer group hover:bg-slate-50/70 dark:hover:bg-[#1f222a]/70 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Custom Checkbox */}
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#1d68ec] border-[#1d68ec] text-white'
                              : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{c.code}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[280px] sm:max-w-md">
                            {c.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#20232b] px-2 py-0.5 rounded-md">
                          {units} units
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCourse(c);
                          }}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {isSelected ? '✓ Added' : '+ Add'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── CARD 2: Your selection ── */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Your selection ({selectedCourses.length})
              </h2>
              {selectedCourses.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold text-[#1d68ec] dark:text-[#38bdf8] hover:underline transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Choose the grade you expect for each course
            </p>

            {selectedCourses.length === 0 ? (
              /* Empty State */
              <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl py-12 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#20232b] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                  <Calculator className="w-5 h-5 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No courses picked yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed">
                  Add courses from the list above, then choose a grade for each to see your projected CGPA.
                </p>
              </div>
            ) : (
              /* Populated Selection */
              <div className="space-y-3">
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {selectedCourses.map((c) => {
                    const points = c.units * GRADE_POINTS[c.grade];

                    return (
                      <div
                        key={c.id}
                        className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Course code & title */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{c.code}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{c.title}</p>
                        </div>

                        {/* Units Stepper + Grade Pills + Points + Delete */}
                        <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                          {/* Units Stepper */}
                          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#15171c] px-2 py-0.5 text-xs text-slate-700 dark:text-slate-300">
                            <button
                              type="button"
                              onClick={() => handleAdjustUnits(c.id, -1)}
                              className="p-1 hover:text-[#1d68ec] transition-colors"
                              aria-label="Decrease units"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 font-semibold text-[11px]">{c.units} units</span>
                            <button
                              type="button"
                              onClick={() => handleAdjustUnits(c.id, 1)}
                              className="p-1 hover:text-[#1d68ec] transition-colors"
                              aria-label="Increase units"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Grade Pills */}
                          <div className="flex items-center gap-1">
                            {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => handleUpdateGrade(c.id, g)}
                                className={`w-7 h-7 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                                  c.grade === g
                                    ? 'bg-[#1d68ec] text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-[#20232b] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>

                          {/* Points */}
                          <span className="text-xs font-bold text-[#1d68ec] dark:text-[#38bdf8] min-w-[42px] text-right">
                            {points} pts
                          </span>

                          {/* Delete X */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSelected(c.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            aria-label="Remove course"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Total Summary */}
                <div className="mt-4 p-3.5 bg-slate-50 dark:bg-[#1a1d24] rounded-xl flex items-center justify-between text-xs font-bold border border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-900 dark:text-white">Total</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {totalSelectedUnits} units · {totalQualityPoints} quality points
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════ RIGHT COLUMN: PROJECTED CGPA & GRADE SCALE (5 cols) ══════════════ */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* ── CARD 1: Projected CGPA ── */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Projected CGPA</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">5.00 scale</span>
            </div>

            {/* Gauge */}
            <CGPAGauge value={projectedCGPA} />

            {/* Sub-label under gauge */}
            <div className="text-center mt-2 mb-4">
              {selectedCourses.length === 0 && approvedUnits === 0 ? (
                <span className="text-xs text-slate-400 dark:text-slate-500">Add courses to see your projection</span>
              ) : activeClassification ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  {activeClassification.label}
                </span>
              ) : null}
            </div>

            {/* 3-Stat Boxes */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-[#1a1d24] p-3 text-center">
                <span className="block text-base font-bold text-slate-900 dark:text-white">
                  {selectedCourses.length}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Courses</span>
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-[#1a1d24] p-3 text-center">
                <span className="block text-base font-bold text-slate-900 dark:text-white">{totalSelectedUnits}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Units</span>
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-[#1a1d24] p-3 text-center">
                <span className="block text-base font-bold text-slate-900 dark:text-white">{totalQualityPoints}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Points</span>
              </div>
            </div>

            {/* Current CGPA info */}
            <div className="border-t border-slate-100 dark:border-slate-800/70 pt-3 pb-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                <span>Current CGPA</span>
                <span>{currentCGPA.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-snug">
                {approvedUnits === 0
                  ? 'No approved results yet, so this projection uses only the courses you picked.'
                  : `Combines your ${approvedUnits} approved units with ${totalSelectedUnits} projected units.`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  // Trigger visual calculation projection animation
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1656c4] text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run projection</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-full border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                title="Reset selection"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* ── CARD 2: Grade scale & Classification ── */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#22252b] bg-white dark:bg-[#181a20] p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Grade scale</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
              Standard 5-point scale. Confirm with your department.
            </p>

            {/* Grades Table */}
            <div className="space-y-1.5">
              {GRADE_SCALE.map((s) => (
                <div
                  key={s.grade}
                  className="flex items-center justify-between py-1 text-xs text-slate-700 dark:text-slate-300"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#20232b] text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center">
                      {s.grade}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">{s.range}</span>
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{s.point}</span>
                </div>
              ))}
            </div>

            {/* Classification Table */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/70">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase block mb-2">
                CLASSIFICATION
              </span>

              <div className="space-y-1">
                {CLASSIFICATIONS.map((c) => {
                  const isActive = activeClassification?.label === c.label;

                  return (
                    <div
                      key={c.label}
                      className={`flex items-center justify-between text-xs transition-all ${
                        isActive
                          ? 'bg-[#1d68ec] text-white px-3 py-1.5 rounded-lg font-bold shadow-sm'
                          : 'px-3 py-1 text-slate-600 dark:text-slate-400 font-medium'
                      }`}
                    >
                      <span>{c.label}</span>
                      <span className={isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}>{c.range}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── FOOTER NOTE ────────────────── */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-6">
        Credit units shown are placeholders. Replace them with units from your course catalogue.
      </p>
    </div>
  );
}
