import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  RotateCw,
  Search,
  BookOpen,
  ClipboardList,
  AlertTriangle,
  HelpCircle,
  CreditCard,
  Loader2,
  X,
  Calendar,
  Layers,
  ArrowRight,
  PenTool,
  Download,
  FileCheck,
  Plus,
} from 'lucide-react';
import { getCourses, getCoursesByLevelAndSemester } from '../../api/courses';
import {
  submitRegistration,
  getActiveSessionAndSemester,
  getMyRegisteredCourseIDs,
  getStudentRegistrations,
  type RawSession,
  type RawSemester,
} from '../../api/course-registrations';
import { getMyDues, checkDuePaid } from '../../api/payments';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errors';
import type { Course, User } from '../../types';

type Tab = 'register' | 'registrations';

interface RegisteredCourseRow {
  id: string;
  course_id: string;
  status: string;
  grade?: string;
  ca_score?: number;
  caScore?: number;
  exam_score?: number;
  examScore?: number;
  is_carryover?: boolean;
  isCarryover?: boolean;
}

interface RegistrationRow {
  id: string;
  status: string;
  total_units?: number;
  totalUnits?: number;
  created_at?: string;
  registered_courses?: RegisteredCourseRow[];
}

type UserWithStudentId = User & { studentId?: string; student_id?: string };

export default function CourseRegistrationPage() {
  const { success, warning, error: notifyError } = useNotification();
  const { user } = useAuth();

  // Active top navigation tab
  const [activeTab, setActiveTab] = useState<Tab>('register');

  // Course registration state
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [registeredCourseIds, setRegisteredCourseIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semesterInfo, setSemesterInfo] = useState<{ session: RawSession | null; semester: RawSemester | null }>({
    session: null,
    semester: null,
  });
  const [loadError, setLoadError] = useState(false);

  // Search & Type Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'compulsory' | 'elective'>('all');

  // Other levels courses state
  const [showOtherLevelsModal, setShowOtherLevelsModal] = useState(false);
  const [otherLevelCourses, setOtherLevelCourses] = useState<Course[]>([]);
  const [otherLevelFilter, setOtherLevelFilter] = useState<number | 'all'>('all');
  const [otherLevelSearch, setOtherLevelSearch] = useState('');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Dues gate check state
  const [unpaidDues, setUnpaidDues] = useState<string[]>([]);
  const [duesChecked, setDuesChecked] = useState(false);

  // My Registrations tab state
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  const studentLevel = user?.level || 0;
  const minUnits = 4;
  const maxUnits = 24;

  // Helper to test if a course is compulsory / core
  const isCompulsoryCourse = useCallback((course: Course) => {
    const type = (course.courseType || '').toLowerCase();
    const sub = (course.subcategory || '').toLowerCase();
    return type === 'core' || type === 'compulsory' || sub === 'compulsory' || sub === 'core';
  }, []);

  // Load active semester and available courses
  const loadCourses = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const semResult = await getActiveSessionAndSemester();
      setSemesterInfo(semResult);

      if (!semResult.semester) {
        setLoadError(true);
        setCourses([]);
        return;
      }

      const semName = semResult.semester.name || semResult.semester.season || 'first';
      const allLevels = [100, 200, 300, 400, 500];
      const otherLevels = allLevels.filter((lvl) => lvl !== studentLevel);

      const [courseList, regIds, allCourseList, ...otherLevelLists] = await Promise.all([
        getCoursesByLevelAndSemester(studentLevel, semName),
        getMyRegisteredCourseIDs().catch(() => []),
        getCourses({ perPage: 100 }).catch(() => []),
        ...otherLevels.map((lvl) => getCoursesByLevelAndSemester(lvl, semName).catch(() => [] as Course[])),
      ]);
      setCourses(courseList || []);
      setAllCourses(allCourseList || []);
      setRegisteredCourseIds(new Set(regIds || []));
      setOtherLevelCourses((otherLevelLists || []).flat());
    } catch {
      setLoadError(true);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [studentLevel]);

  // Load existing registrations
  const loadRegistrations = useCallback(async () => {
    setLoadingRegistrations(true);
    try {
      const u = user as UserWithStudentId | null;
      const studentId = u?.studentId || u?.student_id || u?.id;
      if (!studentId) return;
      const regs = await getStudentRegistrations(studentId);
      setRegistrations(Array.isArray(regs) ? regs : []);
    } catch {
      notifyError('Error', 'Failed to load your registrations.');
    } finally {
      setLoadingRegistrations(false);
    }
  }, [user, notifyError]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (activeTab === 'registrations') {
      loadRegistrations();
    }
  }, [activeTab, loadRegistrations]);

  // Check required unpaid dues
  useEffect(() => {
    let cancelled = false;
    const checkDues = async () => {
      try {
        const dues = await getMyDues(studentLevel);
        const requiredDues = (dues || []).filter(
          (d) => d.is_active && (d.type === 'dept_dues' || d.type === 'class_dues'),
        );
        const results = await Promise.all(
          requiredDues.map(async (d) => {
            try {
              const status = await checkDuePaid(d.id);
              return status.is_paid ? null : d.name;
            } catch {
              return null;
            }
          }),
        );
        if (!cancelled) setUnpaidDues(results.filter((n): n is string => !!n));
      } catch {
        // Continue gracefully
      } finally {
        if (!cancelled) setDuesChecked(true);
      }
    };
    checkDues();
    return () => {
      cancelled = true;
    };
  }, [studentLevel]);

  // Standard available courses for student's level
  const studentAvailableCourses = useMemo(() => {
    return courses.filter((c) => !registeredCourseIds.has(c.id));
  }, [courses, registeredCourseIds]);

  // Selected other-level courses
  const selectedOtherLevelCourses = useMemo(() => {
    return otherLevelCourses.filter(
      (c) => selectedIds.includes(c.id) && !studentAvailableCourses.some((sc) => sc.id === c.id),
    );
  }, [otherLevelCourses, selectedIds, studentAvailableCourses]);

  // All courses available to display in main list
  const availableCourses = useMemo(() => {
    return [...studentAvailableCourses, ...selectedOtherLevelCourses];
  }, [studentAvailableCourses, selectedOtherLevelCourses]);

  const compulsoryCourses = useMemo(() => {
    return availableCourses.filter(isCompulsoryCourse);
  }, [availableCourses, isCompulsoryCourse]);

  const electiveCourses = useMemo(() => {
    return availableCourses.filter((c) => !isCompulsoryCourse(c));
  }, [availableCourses, isCompulsoryCourse]);

  // Semester display name
  const semesterDisplayName = useMemo(() => {
    const sName = (semesterInfo.semester?.name || semesterInfo.semester?.season || '').toLowerCase();
    if (sName.includes('first') || sName.includes('harmattan')) return 'First semester';
    if (sName.includes('second') || sName.includes('rain')) return 'Second semester';
    return sName ? `${sName} semester` : 'First semester';
  }, [semesterInfo.semester]);

  // Filtered other level courses for modal
  const filteredOtherLevelCourses = useMemo(() => {
    return otherLevelCourses.filter((c) => {
      if (c.level === studentLevel) return false;
      if (otherLevelFilter !== 'all' && c.level !== otherLevelFilter) return false;
      if (otherLevelSearch.trim()) {
        const q = otherLevelSearch.toLowerCase().trim();
        return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
      }
      return true;
    });
  }, [otherLevelCourses, studentLevel, otherLevelFilter, otherLevelSearch]);

  const availableOtherLevels = useMemo(() => {
    const s = new Set<number>();
    otherLevelCourses.forEach((c) => {
      if (c.level !== studentLevel) s.add(c.level);
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [otherLevelCourses, studentLevel]);

  // Filtered courses based on search and type pill
  const displayedCourses = useMemo(() => {
    let list = availableCourses;
    if (typeFilter === 'compulsory') {
      list = compulsoryCourses;
    } else if (typeFilter === 'elective') {
      list = electiveCourses;
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
  }, [availableCourses, compulsoryCourses, electiveCourses, typeFilter, searchQuery]);

  // Selected courses and units calculation
  const selectedCourses = useMemo(() => {
    return availableCourses.filter((c) => selectedIds.includes(c.id));
  }, [availableCourses, selectedIds]);

  const totalUnits = useMemo(() => {
    return selectedCourses.reduce((sum, c) => sum + (c.unit || c.creditUnits || 0), 0);
  }, [selectedCourses]);

  // Registered courses resolution for My registrations tab
  const registeredCoursesList = useMemo(() => {
    const list: Course[] = [];
    registeredCourseIds.forEach((id) => {
      const match = courses.find((c) => c.id === id) || allCourses.find((c) => c.id === id);
      if (match && !list.some((item) => item.id === match.id)) {
        list.push(match);
      }
    });

    // Also look inside student registrations if any
    registrations.forEach((r) => {
      (r.registered_courses || []).forEach((rc) => {
        const match = courses.find((c) => c.id === rc.course_id) || allCourses.find((c) => c.id === rc.course_id);
        if (match && !list.some((item) => item.id === match.id)) {
          list.push(match);
        }
      });
    });

    return list;
  }, [courses, allCourses, registeredCourseIds, registrations]);

  const totalRegisteredUnits = useMemo(() => {
    return registeredCoursesList.reduce((sum, c) => sum + (c.unit || c.creditUnits || 0), 0);
  }, [registeredCoursesList]);

  const canSubmit =
    totalUnits >= minUnits &&
    totalUnits <= maxUnits &&
    selectedCourses.length > 0 &&
    !submitting &&
    unpaidDues.length === 0;

  // Toggle selection with strict 24 credit unit maximum enforcement
  const toggleCourse = (courseOrId: Course | string) => {
    const courseId = typeof courseOrId === 'string' ? courseOrId : courseOrId.id;
    if (selectedIds.includes(courseId)) {
      setSelectedIds((prev) => prev.filter((item) => item !== courseId));
      return;
    }
    const course =
      typeof courseOrId !== 'string'
        ? courseOrId
        : availableCourses.find((c) => c.id === courseId) || otherLevelCourses.find((c) => c.id === courseId);
    const units = course ? course.unit || course.creditUnits || 0 : 0;
    if (totalUnits + units > maxUnits) {
      warning(
        'Credit Limit Exceeded',
        `Cannot add ${course?.code || 'this course'} (${units} units). Maximum credit load is ${maxUnits} units (currently ${totalUnits} units).`,
      );
      return;
    }
    setSelectedIds((prev) => [...prev, courseId]);
  };

  // Select all compulsory courses with credit limit cap
  const handleSelectAllCompulsory = () => {
    const compulsoryIds = compulsoryCourses.map((c) => c.id);
    const allAlreadySelected = compulsoryIds.every((id) => selectedIds.includes(id));

    if (allAlreadySelected) {
      // Deselect them
      setSelectedIds((prev) => prev.filter((id) => !compulsoryIds.includes(id)));
    } else {
      let currentUnits = totalUnits;
      const toAdd: string[] = [];
      let reachedCap = false;

      for (const course of compulsoryCourses) {
        if (!selectedIds.includes(course.id)) {
          const u = course.unit || course.creditUnits || 0;
          if (currentUnits + u <= maxUnits) {
            currentUnits += u;
            toAdd.push(course.id);
          } else {
            reachedCap = true;
          }
        }
      }
      if (reachedCap) {
        warning('Credit Limit Cap', `Added compulsory courses up to the maximum limit of ${maxUnits} units.`);
      }
      setSelectedIds((prev) => Array.from(new Set([...prev, ...toAdd])));
    }
  };

  // Submit registration handler
  const handleConfirmSubmit = async () => {
    if (!semesterInfo.session || !semesterInfo.semester) {
      notifyError('Error', 'No active session or semester found.');
      return;
    }
    if (totalUnits < minUnits) {
      warning('Insufficient Credits', `You must register at least ${minUnits} credit units.`);
      return;
    }
    if (totalUnits > maxUnits) {
      warning('Credit Overflow', `Maximum allowed credit units is ${maxUnits}.`);
      return;
    }
    if (unpaidDues.length > 0) {
      notifyError('Outstanding Dues', 'Pay your outstanding dues before registering for courses.');
      return;
    }

    setSubmitting(true);
    try {
      await submitRegistration({
        session_id: semesterInfo.session.id,
        semester_id: semesterInfo.semester.id,
        course_ids: selectedIds,
      });
      success(
        'Registration Submitted',
        `Successfully registered ${selectedCourses.length} courses (${totalUnits} units) for the semester.`,
      );
      setSelectedIds([]);
      setShowConfirmModal(false);
      loadCourses();
    } catch (err) {
      notifyError('Registration Failed', getErrorMessage(err, 'Failed to submit registration.'));
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = Math.min(100, Math.max(0, (totalUnits / maxUnits) * 100));
  const minPercent = (minUnits / maxUnits) * 100;

  return (
    <div className="flex flex-col min-h-0 text-[var(--text)] space-y-6 pb-12">
      {/* ======================================================== */}
      {/* TOP HEADER & CONTROLS                                    */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">Course Registration</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Select and register your academic courses for the current semester.
          </p>

          {/* Subheader Badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 dark:border-[#282b37] bg-white/70 dark:bg-[#161820]/70 text-[var(--text)] shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {semesterInfo.semester?.name === 'harmattan' || semesterInfo.semester?.name === 'first'
                  ? 'First semester'
                  : semesterInfo.semester?.name === 'rain' || semesterInfo.semester?.name === 'second'
                    ? 'Second semester'
                    : semesterInfo.semester?.name
                      ? `${semesterInfo.semester.name} semester`
                      : 'Current semester'}
              </span>
            </span>

            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 dark:border-[#282b37] bg-white/70 dark:bg-[#161820]/70 text-[var(--text)] shadow-xs">
              Level {studentLevel}
            </span>

            {loadError || !semesterInfo.semester ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>No active semester</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Registration open</span>
              </span>
            )}
          </div>
        </div>

        {/* Top Right Buttons: Register courses / My registrations / Refresh */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all shadow-sm ${
              activeTab === 'register'
                ? 'bg-[#1d68ec] text-white shadow-blue-500/20'
                : 'border border-slate-200 dark:border-[#282b37] bg-white dark:bg-[#161820] hover:bg-slate-50 dark:hover:bg-[#1f222d] text-[var(--text)]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Register courses</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all shadow-sm ${
              activeTab === 'registrations'
                ? 'bg-[#1d68ec] text-white shadow-blue-500/20'
                : 'border border-slate-200 dark:border-[#282b37] bg-white dark:bg-[#161820] hover:bg-slate-50 dark:hover:bg-[#1f222d] text-[var(--text)]'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>My registrations</span>
            {(registeredCoursesList.length > 0 || registeredCourseIds.size > 0 || registrations.length > 0) && (
              <span
                className={`ml-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'registrations'
                    ? 'bg-[#0f2d6b] text-white dark:bg-[#0c1f4d] dark:text-blue-200'
                    : 'bg-slate-100 dark:bg-[#20232e] text-[var(--text)]'
                }`}
              >
                {registeredCoursesList.length || registeredCourseIds.size || registrations.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              loadCourses();
              if (activeTab === 'registrations') loadRegistrations();
            }}
            className="p-2.5 sm:px-3 sm:py-2 rounded-full border border-slate-200 dark:border-[#282b37] bg-white dark:bg-[#161820] hover:bg-slate-50 dark:hover:bg-[#1f222d] text-[var(--text)] text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-all shadow-sm"
            title="Refresh courses"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* UNPAID DUES WARNING BANNER (When applicable)             */}
      {/* ======================================================== */}
      {duesChecked && unpaidDues.length > 0 && (
        <div className="rounded-2xl border border-amber-400/70 dark:border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/15 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#facc15] text-slate-900 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[var(--text)]">Pay your dues to unlock course registration</h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Outstanding dues: <span className="font-semibold text-[var(--text)]">{unpaidDues.join(', ')}</span>.
                Clear them in Payments first.
              </p>
            </div>
          </div>
          <Link
            to="/payments"
            className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all whitespace-nowrap self-start sm:self-auto"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pay dues now</span>
          </Link>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: REGISTER COURSES                                    */}
      {/* ======================================================== */}
      {activeTab === 'register' && (
        <>
          {/* STATE A: NO ACTIVE SEMESTER / SERVER ERROR (Screenshots 1 & 3) */}
          {(loadError || !semesterInfo.semester) && !loading ? (
            <div className="space-y-6">
              {/* Red Alert Banner */}
              <div className="rounded-2xl border border-rose-500/30 dark:border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/10 p-6 shadow-sm border-l-4 border-l-rose-500 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[var(--text)]">Unable to load courses</h3>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                      No active semester was found, or the server cannot be reached.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={loadCourses}
                    className="px-5 py-2.5 rounded-full bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Try again</span>
                  </button>

                  <Link
                    to="/complaints"
                    className="px-5 py-2.5 rounded-full border border-slate-200 dark:border-[#2b2e3c] bg-white dark:bg-[#161820] hover:bg-slate-50 dark:hover:bg-[#1c1f28] text-xs font-bold text-[var(--text)] inline-flex items-center gap-2 transition-all shadow-sm"
                  >
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                    <span>File a ticket</span>
                  </Link>
                </div>
              </div>

              {/* 2-Column Error Troubleshooting Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Card: What you can try (~8 cols) */}
                <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-5">
                  <h3 className="text-base font-bold text-[var(--text)]">What you can try</h3>

                  <div className="space-y-4 divide-y divide-slate-100 dark:divide-[#20232e]">
                    {/* Item 1 */}
                    <div className="flex items-start gap-3.5 pt-3 first:pt-0">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#20232e] text-[var(--text)] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[var(--text)]">Check your connection</p>
                        <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
                          Make sure you are online, then refresh.
                        </p>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex items-start gap-3.5 pt-4">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#20232e] text-[var(--text)] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[var(--text)]">Come back later</p>
                        <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
                          Registration may not be open yet. Your department opens it each semester.
                        </p>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex items-start gap-3.5 pt-4">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#20232e] text-[var(--text)] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[var(--text)]">Still stuck?</p>
                        <p className="text-[11px] sm:text-xs text-[var(--text-muted)] mt-0.5">
                          File a ticket and the department will check the semester setup.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Card: Registration Summary (~4 cols) */}
                <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-5">
                  <h3 className="text-base font-bold text-[var(--text)]">Registration summary</h3>

                  <div className="space-y-3 text-xs divide-y divide-slate-100 dark:divide-[#20232e]">
                    <div className="flex items-center justify-between pt-2 first:pt-0 font-medium">
                      <span className="text-[var(--text-muted)]">Level</span>
                      <span className="font-bold text-[var(--text)]">{studentLevel}</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 font-medium">
                      <span className="text-[var(--text-muted)]">Selected courses</span>
                      <span className="font-bold text-[var(--text)]">0</span>
                    </div>
                  </div>

                  {/* Credit Units Box */}
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-[#222530] bg-slate-50/50 dark:bg-[#12141a] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-muted)]">Credit units</span>
                      <span className="text-xl font-extrabold text-[var(--text)]">0 / {maxUnits}</span>
                    </div>

                    {/* Progress Track */}
                    <div className="relative h-2 w-full bg-slate-200 dark:bg-[#252833] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1d68ec] rounded-full w-0" />
                    </div>

                    {/* Range Labels */}
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>0</span>
                      <span className="font-bold">Min {minUnits}</span>
                      <span>Max {maxUnits}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 rounded-full border border-slate-300 dark:border-[#2b2e3c] text-center leading-4 text-[10px]">
                      i
                    </span>
                    Pick at least {minUnits} credit units to submit.
                  </p>

                  <button
                    disabled
                    className="w-full py-3.5 px-4 rounded-xl bg-[#1d68ec]/40 text-white/70 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Review and submit</span>
                  </button>

                  <p className="text-[11px] text-[var(--text-muted)] text-center">
                    You can review your choices before anything is submitted.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* STATE B & C: ACTIVE REGISTRATION VIEW (Screenshots 2, 4, 5) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ======================================================== */}
              {/* LEFT CARD: AVAILABLE COURSES (~8 cols)                   */}
              {/* ======================================================== */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-4">
                {/* Available Courses Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[var(--text)]">Available courses</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {loading
                        ? 'Fetching courses for this semester...'
                        : `${availableCourses.length} courses for Level ${studentLevel} · ${registeredCourseIds.size} already registered`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                    {/* Small button to view other level courses for this semester */}
                    <button
                      type="button"
                      onClick={() => setShowOtherLevelsModal(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/40 text-[#1d68ec] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 inline-flex items-center gap-1.5 transition-all shadow-xs"
                      title="View courses from other levels for this semester"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Other levels ({semesterDisplayName})</span>
                      {selectedOtherLevelCourses.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#1d68ec] text-white text-[10px] flex items-center justify-center font-bold">
                          {selectedOtherLevelCourses.length}
                        </span>
                      )}
                    </button>

                    {loading ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-500 font-semibold">
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading courses...</span>
                      </span>
                    ) : (
                      compulsoryCourses.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSelectAllCompulsory}
                          className="text-xs font-bold text-[#1d68ec] hover:underline transition-colors"
                        >
                          {compulsoryCourses.every((c) => selectedIds.includes(c.id))
                            ? 'Deselect all compulsory'
                            : 'Select all compulsory'}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by code or title"
                    className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-[#282b37] bg-white dark:bg-[#13151b] text-xs text-[var(--text)] placeholder-slate-400 focus:outline-none focus:border-[#1d68ec] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills: All / Compulsory / Elective */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTypeFilter('all')}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                      typeFilter === 'all'
                        ? 'bg-[#1d68ec] text-white shadow-xs'
                        : 'border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    All {availableCourses.length}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTypeFilter('compulsory')}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                      typeFilter === 'compulsory'
                        ? 'bg-[#1d68ec] text-white shadow-xs'
                        : 'border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Compulsory {compulsoryCourses.length}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTypeFilter('elective')}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                      typeFilter === 'elective'
                        ? 'bg-[#1d68ec] text-white shadow-xs'
                        : 'border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Elective {electiveCourses.length}
                  </button>
                </div>

                {/* Course List / Skeletons */}
                {loading ? (
                  /* Loading Skeletons matching Screenshots 2 & 5 */
                  <div className="divide-y divide-slate-100 dark:divide-[#20232e] border border-slate-100 dark:border-[#20232e] rounded-2xl overflow-hidden">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex items-center justify-between gap-3 animate-pulse bg-slate-50/30 dark:bg-[#14161f]"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-slate-200 dark:bg-[#252833] shrink-0" />
                          <div className="space-y-2 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-16 bg-slate-200 dark:bg-[#252833] rounded" />
                              <div className="h-4 w-20 bg-slate-200/70 dark:bg-[#252833]/60 rounded-full" />
                            </div>
                            <div className="h-3 w-48 sm:w-64 bg-slate-200/60 dark:bg-[#252833]/40 rounded" />
                          </div>
                        </div>
                        <div className="h-6 w-14 rounded-full bg-slate-200 dark:bg-[#252833] shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : displayedCourses.length === 0 ? (
                  /* Empty state */
                  <div className="py-16 text-center space-y-2 border border-dashed border-slate-200 dark:border-[#252833] rounded-2xl">
                    <p className="text-sm font-bold text-[var(--text)]">No courses found</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {searchQuery
                        ? 'Try adjusting your search query or filter.'
                        : 'No available courses configured for this level and semester.'}
                    </p>
                  </div>
                ) : (
                  /* Real Course List Rows matching Screenshot 4 */
                  <div className="divide-y divide-slate-100 dark:divide-[#20232e] border border-slate-100 dark:border-[#20232e] rounded-2xl overflow-hidden">
                    {displayedCourses.map((c) => {
                      const isSelected = selectedIds.includes(c.id);
                      const isComp = isCompulsoryCourse(c);
                      const unitCount = c.unit || c.creditUnits || 0;

                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleCourse(c.id)}
                          className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-blue-50/40 dark:bg-blue-950/20'
                              : 'hover:bg-slate-50/70 dark:hover:bg-[#151720]'
                          }`}
                        >
                          {/* Left: Checkbox + Course Details */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Custom styled checkbox */}
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'bg-[#1d68ec] border-[#1d68ec] text-white shadow-xs'
                                  : 'border-slate-300 dark:border-[#383d4e] bg-white dark:bg-[#181a23]'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs sm:text-sm text-[var(--text)]">{c.code}</span>
                                {c.level !== studentLevel && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/30">
                                    Carryover · {c.level}L
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isComp
                                      ? 'border border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30'
                                      : 'border border-slate-300 dark:border-[#2b2e3c] text-[var(--text-muted)] bg-slate-100/50 dark:bg-[#1e2029]'
                                  }`}
                                >
                                  {isComp ? 'Compulsory' : 'Elective'}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-sm sm:max-w-md">
                                {c.title}
                              </p>
                            </div>
                          </div>

                          {/* Right: Units Badge */}
                          <span className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-[#2b2e3c] bg-slate-50/60 dark:bg-[#181a23] text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap shrink-0">
                            {unitCount} units
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* RIGHT CARD: REGISTRATION SUMMARY (~4 cols)               */}
              {/* ======================================================== */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-5 sticky top-6">
                <h3 className="text-base font-bold text-[var(--text)]">Registration summary</h3>

                <div className="space-y-3 text-xs divide-y divide-slate-100 dark:divide-[#20232e]">
                  <div className="flex items-center justify-between pt-2 first:pt-0 font-medium">
                    <span className="text-[var(--text-muted)]">Level</span>
                    <span className="font-bold text-[var(--text)]">{studentLevel}</span>
                  </div>

                  <div className="flex items-center justify-between pt-3 font-medium">
                    <span className="text-[var(--text-muted)]">Selected courses</span>
                    <span className="font-bold text-[var(--text)]">{selectedCourses.length}</span>
                  </div>
                </div>

                {/* Credit Units Box */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-[#222530] bg-slate-50/50 dark:bg-[#12141a] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">Credit units</span>
                    <span className="text-2xl font-black text-[var(--text)]">
                      {totalUnits} <span className="text-sm font-semibold text-[var(--text-muted)]">/ {maxUnits}</span>
                    </span>
                  </div>

                  {/* Progress Bar Track with Tick Indicator */}
                  <div className="relative h-2 w-full bg-slate-200 dark:bg-[#252833] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1d68ec] rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                    {/* Vertical tick marker for Min units */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500"
                      style={{ left: `${minPercent}%` }}
                    />
                  </div>

                  {/* Range Labels */}
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                    <span>0</span>
                    <span className="font-bold text-[var(--text)]">Min {minUnits}</span>
                    <span>Max {maxUnits}</span>
                  </div>
                </div>

                {/* Minimum Units Requirement or List of Selected Tags */}
                {totalUnits >= minUnits ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Minimum units met</span>
                    </div>

                    {/* Selected Course Code Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCourses.map((c) => (
                        <span
                          key={c.id}
                          className="px-2.5 py-1 rounded-full border border-slate-200 dark:border-[#2b2e3c] bg-white dark:bg-[#161820] text-xs font-bold text-[var(--text)] shadow-xs"
                        >
                          {c.code}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
                    <span className="inline-block w-4 h-4 rounded-full border border-slate-300 dark:border-[#2b2e3c] text-center leading-4 text-[10px]">
                      i
                    </span>
                    Pick at least {minUnits} credit units to submit.
                  </p>
                )}

                {/* Review & Submit Action Button */}
                <button
                  disabled={!canSubmit}
                  onClick={() => setShowConfirmModal(true)}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] ${
                    canSubmit
                      ? 'bg-[#1d68ec] hover:bg-[#1554c2] text-white cursor-pointer shadow-blue-500/20'
                      : 'bg-[#1d68ec]/40 text-white/70 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Review and submit</span>
                </button>

                <p className="text-[11px] text-[var(--text-muted)] text-center">
                  You can review your choices before anything is submitted.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB: MY REGISTRATIONS (Screenshots 1, 2, 3)              */}
      {/* ======================================================== */}
      {activeTab === 'registrations' && (
        <div className="space-y-6">
          {loadingRegistrations || loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec]" />
              <p className="text-xs text-[var(--text-muted)]">Loading your registrations...</p>
            </div>
          ) : registeredCoursesList.length === 0 ? (
            /* Screenshot 2: Empty State */
            <div className="rounded-3xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-16 sm:p-20 text-center shadow-sm space-y-4 max-w-4xl mx-auto my-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center mx-auto mb-2">
                <FileCheck className="w-8 h-8 stroke-[1.8]" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[var(--text)]">No registrations yet</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                Once you register your courses for the semester, they will be listed here with their status.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="px-6 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-all active:scale-[0.99]"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Register courses</span>
                </button>
              </div>
            </div>
          ) : (
            /* Screenshots 1 & 3: Active Registered View */
            <div className="space-y-6">
              {/* 3 Stat Cards Across Top */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Courses Stat Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)]">Courses</p>
                    <p className="text-2xl font-black text-[var(--text)] mt-0.5">{registeredCoursesList.length}</p>
                  </div>
                </div>

                {/* 2. Credit Units Stat Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)]">Credit units</p>
                    <p className="text-2xl font-black text-[var(--text)] mt-0.5">
                      {totalRegisteredUnits}{' '}
                      <span className="text-sm font-semibold text-[var(--text-muted)]">/ {maxUnits}</span>
                    </p>
                  </div>
                </div>

                {/* 3. Status Stat Card */}
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)]">Status</p>
                    <p className="text-xl font-black text-emerald-500 dark:text-emerald-400 mt-0.5">Registered</p>
                  </div>
                </div>
              </div>

              {/* 2-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Registered courses Table (~8 cols) */}
                <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] p-6 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--text)]">Registered courses</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Level {studentLevel} · Current semester</p>
                  </div>

                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-[#20232e] text-[11px] font-bold text-[var(--text-muted)] tracking-wider">
                          <th className="py-3 px-3">CODE</th>
                          <th className="py-3 px-3">TITLE</th>
                          <th className="py-3 px-3">TYPE</th>
                          <th className="py-3 px-3">UNITS</th>
                          <th className="py-3 px-3">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#20232e]">
                        {registeredCoursesList.map((c) => {
                          const isComp = isCompulsoryCourse(c);
                          const unitCount = c.unit || c.creditUnits || 0;
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13151b] transition-colors">
                              <td className="py-3.5 px-3 font-extrabold text-xs sm:text-sm text-[var(--text)] whitespace-nowrap">
                                {c.code}
                              </td>
                              <td className="py-3.5 px-3 font-medium text-xs sm:text-sm text-[var(--text)]">
                                {c.title}
                              </td>
                              <td className="py-3.5 px-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                                {isComp ? 'Compulsory' : 'Elective'}
                              </td>
                              <td className="py-3.5 px-3 font-extrabold text-xs sm:text-sm text-[var(--text)] whitespace-nowrap">
                                {unitCount}
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Registered</span>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Column: Next Steps & Registration Slip (~4 cols) */}
                <div className="lg:col-span-4 space-y-5">
                  {/* Card 1: Next: sign your course form */}
                  <div className="p-6 rounded-2xl border border-blue-500/30 dark:border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/15 shadow-sm space-y-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#1d68ec] flex items-center justify-center">
                      <PenTool className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-[var(--text)]">Next: sign your course form</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                        Now that your courses are registered, upload your course form and add the HOD and Exam Officer
                        signatures.
                      </p>
                    </div>

                    <Link
                      to="/course-form-signing"
                      className="w-full py-3 px-4 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
                    >
                      <span>Go to course form signing</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Card 2: Registration slip */}
                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-[#222530] bg-white dark:bg-[#161820] shadow-sm space-y-3">
                    <h4 className="text-sm sm:text-base font-bold text-[var(--text)]">Registration slip</h4>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Keep a copy of your registered courses.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (!printWindow) {
                          window.print();
                          return;
                        }
                        const html = `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>Course Registration Slip</title>
                              <style>
                                body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #111; }
                                .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 20px; margin-bottom: 30px; }
                                .title { font-size: 22px; font-weight: bold; margin: 0; }
                                .subtitle { font-size: 14px; color: #555; margin-top: 5px; }
                                .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 13px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
                                th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
                                th { background: #f4f4f4; font-weight: bold; }
                                .total { text-align: right; font-weight: bold; margin-top: 20px; font-size: 14px; }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h1 class="title">${user?.tenant?.institution?.toUpperCase() || 'INSTITUTION'}</h1>
                                <p class="subtitle">${user?.tenant?.name || 'Department'} · Course Registration Slip</p>
                              </div>
                              <div class="meta">
                                <div><strong>Student:</strong> ${user?.fullName || user?.full_name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || (user as any)?.name || 'Student'}</div>
                                <div><strong>Level:</strong> ${studentLevel}</div>
                                <div><strong>Semester:</strong> Current Semester</div>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Course Code</th>
                                    <th>Course Title</th>
                                    <th>Type</th>
                                    <th>Credit Units</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${registeredCoursesList
                                    .map(
                                      (c) => `
                                    <tr>
                                      <td><strong>${c.code}</strong></td>
                                      <td>${c.title}</td>
                                      <td>${isCompulsoryCourse(c) ? 'Compulsory' : 'Elective'}</td>
                                      <td>${c.unit || c.creditUnits || 0}</td>
                                      <td style="color: #059669; font-weight: bold;">Registered</td>
                                    </tr>
                                  `,
                                    )
                                    .join('')}
                                </tbody>
                              </table>
                              <div class="total">
                                Total Courses: ${registeredCoursesList.length} &nbsp;|&nbsp; Total Credit Units: ${totalRegisteredUnits}
                              </div>
                              <script>
                                window.onload = function() { window.print(); }
                              </script>
                            </body>
                          </html>
                        `;
                        printWindow.document.write(html);
                        printWindow.document.close();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-[#282b37] hover:bg-slate-50 dark:hover:bg-[#181a23] text-xs sm:text-sm font-bold text-[var(--text)] flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download slip</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* REVIEW & SUBMIT CONFIRMATION MODAL                       */}
      {/* ======================================================== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#161820] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[#222530] shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#20232e]">
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Review Course Registration</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Confirm your selection before final submission
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-[#2b2e3c] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1f222d] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Courses List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedCourses.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#12141a] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-[var(--text)] block">{c.code}</span>
                    <span className="text-[11px] text-[var(--text-muted)] truncate block max-w-xs">{c.title}</span>
                  </div>
                  <span className="font-bold text-[var(--text)] shrink-0">{c.unit || c.creditUnits || 0} units</span>
                </div>
              ))}
            </div>

            {/* Total Summary */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#222530] bg-slate-50/60 dark:bg-[#14161f] flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--text-muted)]">Total Courses & Credits</span>
              <span className="font-black text-sm text-[var(--text)]">
                {selectedCourses.length} courses · {totalUnits} units
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2a2e3c] text-[var(--text)] text-xs font-bold hover:bg-slate-50 dark:hover:bg-[#1f222d] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmSubmit}
                className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Confirm and submit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: COURSES FROM OTHER LEVELS                         */}
      {/* ======================================================== */}
      {showOtherLevelsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#161820] rounded-3xl border border-slate-200 dark:border-[#252833] shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#20232e]">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-[var(--text)]">Other Level Courses</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-[#1d68ec] border border-blue-500/20">
                    {semesterDisplayName}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Select carryover or elective courses from other levels. Maximum total credit load is {maxUnits} units.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOtherLevelsModal(false)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-[#2b2e3c] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-slate-100 dark:hover:bg-[#1f222d] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Credit Load Progress Bar inside Modal */}
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-[#262833] bg-slate-50/60 dark:bg-[#12141a] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text)]">Total credit load:</span>
                  <span
                    className={`text-sm font-black ${totalUnits >= maxUnits ? 'text-amber-500' : 'text-[#1d68ec]'}`}
                  >
                    {totalUnits} / {maxUnits} units
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {maxUnits - totalUnits > 0
                    ? `${maxUnits - totalUnits} unit(s) remaining before reaching the 24-unit cap`
                    : 'Maximum 24 units limit reached — cannot add more courses'}
                </p>
              </div>

              <div className="w-full sm:w-40 h-2 bg-slate-200 dark:bg-[#252833] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    totalUnits >= maxUnits ? 'bg-amber-500' : 'bg-[#1d68ec]'
                  }`}
                  style={{ width: `${Math.min(100, (totalUnits / maxUnits) * 100)}%` }}
                />
              </div>
            </div>

            {/* Search and Level Filter Pills */}
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={otherLevelSearch}
                  onChange={(e) => setOtherLevelSearch(e.target.value)}
                  placeholder="Search other level courses by code or title..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#282b37] bg-white dark:bg-[#13151b] text-xs text-[var(--text)] placeholder-slate-400 focus:outline-none focus:border-[#1d68ec]"
                />
                {otherLevelSearch && (
                  <button
                    type="button"
                    onClick={() => setOtherLevelSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Level Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOtherLevelFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    otherLevelFilter === 'all'
                      ? 'bg-[#1d68ec] text-white shadow-xs'
                      : 'border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  All ({otherLevelCourses.filter((c) => c.level !== studentLevel).length})
                </button>
                {availableOtherLevels.map((lvl) => {
                  const count = otherLevelCourses.filter((c) => c.level === lvl).length;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setOtherLevelFilter(lvl)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        otherLevelFilter === lvl
                          ? 'bg-[#1d68ec] text-white shadow-xs'
                          : 'border border-slate-200 dark:border-[#262833] bg-white dark:bg-[#161820] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {lvl}L ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Courses List */}
            <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 dark:divide-[#20232e] border border-slate-100 dark:border-[#20232e] rounded-2xl pr-1">
              {filteredOtherLevelCourses.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  No courses found matching this level or search for {semesterDisplayName}.
                </div>
              ) : (
                filteredOtherLevelCourses.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  const isRegistered = registeredCourseIds.has(c.id);
                  const unitCount = c.unit || c.creditUnits || 0;
                  const wouldExceedLimit = !isSelected && totalUnits + unitCount > maxUnits;

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-[#14161f] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-xs sm:text-sm text-[var(--text)]">{c.code}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/30">
                            {c.level} Level
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 dark:border-[#282b37] text-[var(--text-muted)]">
                            {unitCount} units
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-sm sm:max-w-md">
                          {c.title}
                        </p>
                      </div>

                      {/* Action Button */}
                      <div className="shrink-0">
                        {isRegistered ? (
                          <span className="text-xs text-[var(--text-muted)] font-semibold px-2.5 py-1">
                            Already registered
                          </span>
                        ) : isSelected ? (
                          <button
                            type="button"
                            onClick={() => toggleCourse(c)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 transition-all group"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3] group-hover:hidden" />
                            <X className="w-3.5 h-3.5 hidden group-hover:block" />
                            <span className="group-hover:hidden">Added</span>
                            <span className="hidden group-hover:inline">Remove</span>
                          </button>
                        ) : wouldExceedLimit ? (
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#1e2029] text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                            title="Adding this course would exceed the 24 credit unit maximum"
                          >
                            Exceeds 24 units
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleCourse(c)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#1d68ec] hover:bg-[#1554c2] text-white inline-flex items-center gap-1 shadow-xs transition-all active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add course</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#20232e]">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {selectedOtherLevelCourses.length} course(s) selected from other levels
              </span>
              <button
                type="button"
                onClick={() => setShowOtherLevelsModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[#1d68ec] hover:bg-[#1554c2] text-white text-xs font-bold shadow-sm transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
