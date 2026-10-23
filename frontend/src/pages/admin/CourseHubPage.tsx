import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Users,
  Search,
  Plus,
  Trash2,
  Archive,
  MoreVertical,
  Check,
  AlertTriangle,
  Loader2,
  X,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Minus,
} from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import { getCourses, createCourse, deleteCourse, updateCourse } from '../../api/courses';
import { getUsers } from '../../api/users';
import { assignCourseToLecturer } from '../../api/lecturers';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import {
  getStudentRegistrations,
  getRegisteredCourses,
  addCourseToRegistration,
  removeCourseFromRegistration,
  createRegistration,
} from '../../api/course-registrations';
import { searchStudentsForRoles } from '../../api/role-management';
import { getStudentPaymentSummary } from '../../api/payments';
import type { Course, User as UserType, AcademicSession, SemesterEntry, StudentForRoleManagement } from '../../types';

export default function CourseHubPage() {
  const { success, error: notifyError } = useNotification();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'courses' | 'enrollment'>('courses');

  // Loading states
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [submittingCourse, setSubmittingCourse] = useState(false);

  // Real Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<UserType[]>([]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selected row checkboxes
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());

  // Slide-over drawer state: Create Course
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUnits, setNewUnits] = useState(3);
  const [newLevel, setNewLevel] = useState(500);
  const [newSemester, setNewSemester] = useState<'First' | 'Second'>('First');
  const [newType, setNewType] = useState<'Dept' | 'Non-Dept'>('Dept');
  const [newRole, setNewRole] = useState<'Core' | 'Elective'>('Core');
  const [newLecturerId, setNewLecturerId] = useState('');

  // Assign Lecturer Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningCourse, setAssigningCourse] = useState<Course | null>(null);
  const [assignedLecturerId, setAssignedLecturerId] = useState('');
  const [assigningSaving, setAssigningSaving] = useState(false);

  // Lecturer Assignments Drawer state
  const [lecturerAssignmentsOpen, setLecturerAssignmentsOpen] = useState(false);

  // Row action menu dropdown state
  const [activeMenuCourseId, setActiveMenuCourseId] = useState<string | null>(null);

  // ── Tab 2: Course Enrollment State ──
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [semesters, setSemesters] = useState<SemesterEntry[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');

  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [searchedStudents, setSearchedStudents] = useState<StudentForRoleManagement[]>([]);
  const [suggestedStudents, setSuggestedStudents] = useState<StudentForRoleManagement[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentForRoleManagement | null>(null);
  const [studentSearching, setStudentSearching] = useState(false);
  const [, setStudentDuesPaid] = useState<boolean>(true);

  const [studentRegisteredCourses, setStudentRegisteredCourses] = useState<any[]>([]);
  const [loadingStudentCourses, setLoadingStudentCourses] = useState(false);

  // Staged changes state
  const [stagedRemovals, setStagedRemovals] = useState<Set<string>>(new Set());
  const [stagedAdditions, setStagedAdditions] = useState<Course[]>([]);
  const [changeReason, setChangeReason] = useState('');
  const [savingChanges, setSavingChanges] = useState(false);
  const [searchAddCourse, setSearchAddCourse] = useState('');

  // Fetch initial course and lecturer data
  const fetchCoursesAndLecturers = useCallback(async () => {
    try {
      setLoadingCourses(true);
      const [crsRes, lctRes, sessRes] = await Promise.all([
        getCourses({ page: 1, perPage: 100 }),
        getUsers({ page: 1, perPage: 100, role: 'lecturer' }),
        getSessions({ page: 1, perPage: 50 }).catch(() => []),
      ]);

      setCourses(Array.isArray(crsRes) ? crsRes : []);
      setLecturers(Array.isArray(lctRes) ? lctRes : []);

      const sessList = Array.isArray(sessRes) ? sessRes : [];
      setSessions(sessList);
      if (sessList.length > 0) {
        const active = sessList.find((s) => s.is_active || s.isActive) || sessList[0];
        setSelectedSessionId(active.id);
      }
    } catch (err: unknown) {
      notifyError('Failed to load courses', getErrorMessage(err, 'Could not fetch catalogue.'));
    } finally {
      setLoadingCourses(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchCoursesAndLecturers();
  }, [fetchCoursesAndLecturers]);

  // Load semesters when session changes
  useEffect(() => {
    if (!selectedSessionId) {
      setSemesters([]);
      setSelectedSemesterId('');
      return;
    }
    listSessionSemesters(selectedSessionId)
      .then((sems) => {
        const list = Array.isArray(sems) ? sems : [];
        setSemesters(list);
        if (list.length > 0) {
          const active = list.find((s) => s.is_active || (s as any).isActive) || list[0];
          setSelectedSemesterId(active.id);
        } else {
          setSelectedSemesterId('');
        }
      })
      .catch(() => {
        setSemesters([]);
        setSelectedSemesterId('');
      });
  }, [selectedSessionId]);

  // Lecturer map
  const lecturerMap = useMemo(() => {
    const map = new Map<string, UserType>();
    lecturers.forEach((l) => map.set(l.id, l));
    return map;
  }, [lecturers]);

  // Count courses without lecturer
  const unassignedCount = useMemo(() => {
    return courses.filter((c) => !c.lecturerId && !(c as any).lecturer_id).length;
  }, [courses]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = c.code.toLowerCase().includes(q);
        const titleMatch = c.title.toLowerCase().includes(q);
        if (!codeMatch && !titleMatch) return false;
      }

      // Level
      if (levelFilter !== 'all') {
        if (String(c.level) !== levelFilter) return false;
      }

      // Type (Dept vs Non-Dept)
      if (typeFilter !== 'all') {
        const isDept = c.courseType?.toLowerCase() === 'departmental' || c.courseType?.toLowerCase() === 'dept';
        if (typeFilter === 'dept' && !isDept) return false;
        if (typeFilter === 'non-dept' && isDept) return false;
      }

      // Role (Core vs Elective)
      if (roleFilter !== 'all') {
        const isCore = c.subcategory?.toLowerCase() === 'core';
        if (roleFilter === 'core' && !isCore) return false;
        if (roleFilter === 'elective' && isCore) return false;
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && !c.isActive) return false;
        if (statusFilter === 'inactive' && c.isActive) return false;
      }

      return true;
    });
  }, [courses, searchQuery, levelFilter, typeFilter, roleFilter, statusFilter]);

  // Pagination calculation
  const totalItems = filteredCourses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedCourses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCourses.slice(start, start + pageSize);
  }, [filteredCourses, currentPage, pageSize]);

  // Select all checkbox
  const allPagedSelected = useMemo(() => {
    if (pagedCourses.length === 0) return false;
    return pagedCourses.every((c) => selectedCourseIds.has(c.id));
  }, [pagedCourses, selectedCourseIds]);

  const toggleSelectAll = () => {
    const next = new Set(selectedCourseIds);
    if (allPagedSelected) {
      pagedCourses.forEach((c) => next.delete(c.id));
    } else {
      pagedCourses.forEach((c) => next.add(c.id));
    }
    setSelectedCourseIds(next);
  };

  const toggleSelectCourse = (id: string) => {
    const next = new Set(selectedCourseIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCourseIds(next);
  };

  // Close menus on outside click
  useEffect(() => {
    const handler = () => setActiveMenuCourseId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Handlers
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newTitle.trim()) {
      notifyError('Missing Fields', 'Course code and title are required.');
      return;
    }

    try {
      setSubmittingCourse(true);
      const created = await createCourse({
        code: newCode.trim().toUpperCase(),
        title: newTitle.trim(),
        unit: newUnits,
        level: newLevel,
        semester: newSemester.toLowerCase(),
        course_type: newType === 'Dept' ? 'departmental' : 'non_departmental',
        requirement_type: newRole.toLowerCase(),
        lecturer_id: newLecturerId || undefined,
        is_active: true,
      });

      if (newLecturerId && created?.id) {
        try {
          await assignCourseToLecturer(newLecturerId, created.id);
        } catch {
          // silent fallback
        }
      }

      success('Course Created', `${newCode.toUpperCase()} - ${newTitle} added to catalogue.`);
      setCreateDrawerOpen(false);
      setNewCode('');
      setNewTitle('');
      setNewUnits(3);
      setNewLevel(500);
      setNewLecturerId('');
      fetchCoursesAndLecturers();
    } catch (err: unknown) {
      notifyError('Failed to Create Course', getErrorMessage(err, 'Could not create course.'));
    } finally {
      setSubmittingCourse(false);
    }
  };

  const handleOpenAssignModal = (c: Course) => {
    setAssigningCourse(c);
    setAssignedLecturerId(c.lecturerId || (c as any).lecturer_id || '');
    setAssignModalOpen(true);
  };

  const handleSaveLecturerAssignment = async () => {
    if (!assigningCourse || !assignedLecturerId) {
      notifyError('Selection Required', 'Please select a lecturer.');
      return;
    }

    try {
      setAssigningSaving(true);
      await assignCourseToLecturer(assignedLecturerId, assigningCourse.id);
      success('Lecturer Assigned', `Assigned to ${assigningCourse.code}.`);
      setAssignModalOpen(false);
      fetchCoursesAndLecturers();
    } catch (err: unknown) {
      notifyError('Assignment Failed', getErrorMessage(err, 'Could not assign lecturer.'));
    } finally {
      setAssigningSaving(false);
    }
  };

  const handleDeleteCourse = async (c: Course) => {
    if (!confirm(`Are you sure you want to delete ${c.code} (${c.title})?`)) return;
    try {
      await deleteCourse(c.id);
      success('Course Deleted', `${c.code} removed from catalogue.`);
      fetchCoursesAndLecturers();
    } catch (err: unknown) {
      notifyError('Delete Failed', getErrorMessage(err, 'Could not delete course.'));
    }
  };

  const handleArchiveCourse = async (c: Course) => {
    try {
      await updateCourse(c.id, { isActive: false });
      success('Course Archived', `${c.code} is now marked as archived.`);
      fetchCoursesAndLecturers();
    } catch (err: unknown) {
      notifyError('Archive Failed', getErrorMessage(err, 'Could not archive course.'));
    }
  };

  // ── Tab 2: Computations, Helpers & Handlers ──
  const currentSessionName = useMemo(() => {
    const s = sessions.find((item) => item.id === selectedSessionId);
    return s?.name || '2026/2027';
  }, [sessions, selectedSessionId]);

  const currentSemesterName = useMemo(() => {
    const sem = semesters.find((item) => item.id === selectedSemesterId);
    if (!sem) return 'First semester';
    const lower = sem.name.toLowerCase();
    return lower.includes('semester') ? sem.name : `${sem.name} semester`;
  }, [semesters, selectedSemesterId]);

  // Load initial suggested students when switching to enrollment tab
  useEffect(() => {
    if (activeTab === 'enrollment' && suggestedStudents.length === 0) {
      searchStudentsForRoles({ per_page: 8 })
        .then((res) => {
          setSuggestedStudents(res.data || []);
        })
        .catch(() => {});
    }
  }, [activeTab, suggestedStudents.length]);

  // Reload student courses when session or semester changes
  useEffect(() => {
    if (selectedStudent && selectedSessionId && selectedSemesterId) {
      const studentId = selectedStudent.student_id || selectedStudent.id;
      setLoadingStudentCourses(true);
      setStagedAdditions([]);
      setStagedRemovals(new Set());
      setChangeReason('');

      getStudentRegistrations(studentId)
        .then(async (regs) => {
          const matchingReg = (regs || []).find(
            (r: any) =>
              (r.sessionId === selectedSessionId || r.session_id === selectedSessionId) &&
              (r.semesterId === selectedSemesterId || r.semester_id === selectedSemesterId),
          );
          if (matchingReg) {
            const rc = await getRegisteredCourses(matchingReg.id);
            setStudentRegisteredCourses(rc || []);
          } else {
            setStudentRegisteredCourses([]);
          }
        })
        .catch(() => setStudentRegisteredCourses([]))
        .finally(() => setLoadingStudentCourses(false));
    }
  }, [selectedStudent, selectedSessionId, selectedSemesterId]);

  // Total Units calculation after staged additions and removals
  const totalUnitsAfterChanges = useMemo(() => {
    let total = 0;
    studentRegisteredCourses.forEach((rc) => {
      if (!stagedRemovals.has(rc.id)) {
        const c = courses.find((item) => item.id === (rc.courseId || rc.course_id));
        total += c?.creditUnits || c?.unit || (c as any)?.credit_units || 3;
      }
    });
    stagedAdditions.forEach((c) => {
      total += c.creditUnits || c.unit || (c as any)?.credit_units || 3;
    });
    return total;
  }, [studentRegisteredCourses, stagedRemovals, stagedAdditions, courses]);

  const isUnitsValid = totalUnitsAfterChanges >= 4 && totalUnitsAfterChanges <= 24;

  const displayCourseCount = useMemo(() => {
    const netCount =
      studentRegisteredCourses.filter((rc) => !stagedRemovals.has(rc.id)).length + stagedAdditions.length;
    return netCount;
  }, [studentRegisteredCourses, stagedRemovals, stagedAdditions]);

  const availableCoursesToAdd = useMemo(() => {
    const registeredCourseIds = new Set(studentRegisteredCourses.map((rc) => rc.courseId || rc.course_id));
    const stagedAdditionIds = new Set(stagedAdditions.map((c) => c.id));

    return courses
      .filter((c) => {
        if (registeredCourseIds.has(c.id)) return false;
        if (stagedAdditionIds.has(c.id)) return false;
        if (searchAddCourse.trim()) {
          const q = searchAddCourse.toLowerCase();
          return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
        }
        return true;
      })
      .slice(0, 10);
  }, [courses, studentRegisteredCourses, stagedAdditions, searchAddCourse]);

  const getInitials = (name?: string) => {
    if (!name) return 'FO';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name.slice(0, 2) || 'FO').toUpperCase();
  };

  const handleSearchStudent = async (query: string) => {
    setStudentSearchInput(query);
    if (!query.trim()) {
      setSearchedStudents([]);
      return;
    }

    try {
      setStudentSearching(true);
      const res = await searchStudentsForRoles({ search: query.trim(), per_page: 10 });
      setSearchedStudents(res.data || []);
    } catch {
      setSearchedStudents([]);
    } finally {
      setStudentSearching(false);
    }
  };

  const handleSelectStudent = async (stu: StudentForRoleManagement) => {
    setSelectedStudent(stu);
    setSearchedStudents([]);
    setStudentSearchInput(
      `${stu.full_name || (stu as any).fullName || 'Student'} (${stu.matric_number || (stu as any).matricNumber || 'Student'})`,
    );
    setStagedAdditions([]);
    setStagedRemovals(new Set());
    setChangeReason('');

    const studentId = stu.student_id || stu.id;

    // Check payment / dues status
    try {
      const summary = await getStudentPaymentSummary(studentId);
      setStudentDuesPaid(summary ? summary.amount_paid > 0 : true);
    } catch {
      setStudentDuesPaid(true);
    }

    if (!selectedSessionId || !selectedSemesterId) return;

    try {
      setLoadingStudentCourses(true);
      const regs = await getStudentRegistrations(studentId);
      const matchingReg = (regs || []).find(
        (r: any) =>
          (r.sessionId === selectedSessionId || r.session_id === selectedSessionId) &&
          (r.semesterId === selectedSemesterId || r.semester_id === selectedSemesterId),
      );

      if (matchingReg) {
        const rc = await getRegisteredCourses(matchingReg.id);
        setStudentRegisteredCourses(rc || []);
      } else {
        setStudentRegisteredCourses([]);
      }
    } catch {
      setStudentRegisteredCourses([]);
    } finally {
      setLoadingStudentCourses(false);
    }
  };

  const toggleStageRemove = (regCourseId: string) => {
    setStagedRemovals((prev) => {
      const next = new Set(prev);
      if (next.has(regCourseId)) {
        next.delete(regCourseId);
      } else {
        next.add(regCourseId);
      }
      return next;
    });
  };

  const handleStageAddCourse = (course: Course) => {
    if (stagedAdditions.some((c) => c.id === course.id)) return;
    setStagedAdditions((prev) => [...prev, course]);
  };

  const handleRemoveStagedAddition = (courseId: string) => {
    setStagedAdditions((prev) => prev.filter((c) => c.id !== courseId));
  };

  const handleDiscardChanges = () => {
    setStagedAdditions([]);
    setStagedRemovals(new Set());
    setChangeReason('');
  };

  const handleSaveChanges = async () => {
    if (!selectedStudent || !selectedSessionId || !selectedSemesterId) return;
    if (!changeReason.trim()) {
      notifyError('Reason Required', 'Please provide a reason for modifying student course enrollment.');
      return;
    }
    if (stagedAdditions.length === 0 && stagedRemovals.size === 0) {
      notifyError('No Changes', 'No course additions or removals staged.');
      return;
    }

    try {
      setSavingChanges(true);
      const studentId = selectedStudent.student_id || selectedStudent.id;
      const regs = await getStudentRegistrations(studentId);
      let matchingReg = (regs || []).find(
        (r: any) =>
          (r.sessionId === selectedSessionId || r.session_id === selectedSessionId) &&
          (r.semesterId === selectedSemesterId || r.semester_id === selectedSemesterId),
      );

      if (!matchingReg) {
        matchingReg = (await createRegistration({
          student_id: studentId,
          session_id: selectedSessionId,
          semester_id: selectedSemesterId,
          total_units: totalUnitsAfterChanges,
        })) as any;
      }

      if (!matchingReg) {
        throw new Error('Registration record not found or could not be created.');
      }

      // Process removals
      for (const regCourseId of stagedRemovals) {
        await removeCourseFromRegistration(matchingReg.id, regCourseId);
      }

      // Process additions
      for (const c of stagedAdditions) {
        await addCourseToRegistration(matchingReg.id, { course_id: c.id });
      }

      success('Changes Saved', 'Student course enrollment updated and audit record logged.');

      // Clear staged states
      setStagedAdditions([]);
      setStagedRemovals(new Set());
      setChangeReason('');

      // Refresh student courses
      const rc = await getRegisteredCourses(matchingReg.id);
      setStudentRegisteredCourses(rc || []);
    } catch (err: unknown) {
      notifyError('Save Failed', getErrorMessage(err, 'Failed to save course changes.'));
    } finally {
      setSavingChanges(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans antialiased text-surface-900 dark:text-surface-100 max-w-7xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wider">
            Academics
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-surface-900 dark:text-white mt-1">
            Course management
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create courses, assign lecturers and manage student enrollments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setLecturerAssignmentsOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
          >
            <Users className="w-3.5 h-3.5 text-surface-500" />
            Lecturer assignments
          </button>

          <button
            type="button"
            onClick={() => setCreateDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create course
          </button>
        </div>
      </div>

      {/* ── Segmented Tab Bar: Courses | Course enrollment ──────────────── */}
      <div className="p-1 rounded-full bg-surface-100 dark:bg-surface-800/60 inline-flex items-center border border-surface-200/60 dark:border-surface-700/60">
        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'courses'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Courses
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('enrollment')}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'enrollment'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Course enrollment
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: COURSES CATALOGUE                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          {/* Warning Banner: Courses without lecturer */}
          {unassignedCount > 0 && (
            <div className="rounded-2xl p-4 bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-surface-900 dark:text-white">
                  {unassignedCount} {unassignedCount === 1 ? 'course' : 'courses'} on this page have no lecturer yet
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLecturerAssignmentsOpen(true)}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white transition-colors shrink-0 shadow-sm"
              >
                Assign lecturers
              </button>
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by code or title"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {/* Level Filter */}
              <select
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 focus:outline-none"
              >
                <option value="all">All levels</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
              </select>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 focus:outline-none"
              >
                <option value="all">All types</option>
                <option value="dept">Dept</option>
                <option value="non-dept">Non-Dept</option>
              </select>

              {/* Role in programme */}
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 focus:outline-none"
              >
                <option value="all">Core and elective</option>
                <option value="core">Core</option>
                <option value="elective">Elective</option>
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-300 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All status</option>
              </select>
            </div>
          </div>

          {/* Courses Table */}
          <div className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900/70 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-800 text-[10px] font-bold text-surface-400 uppercase tracking-wider bg-surface-50/50 dark:bg-surface-800/40">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={allPagedSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-surface-300 dark:border-surface-600 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                    <th className="py-3 px-4">CODE</th>
                    <th className="py-3 px-4">TITLE</th>
                    <th className="py-3 px-4">UNITS</th>
                    <th className="py-3 px-4">LEVEL</th>
                    <th className="py-3 px-4">TYPE</th>
                    <th className="py-3 px-4">ROLE</th>
                    <th className="py-3 px-4">STATUS</th>
                    <th className="py-3 px-4">LECTURER</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800 text-xs">
                  {loadingCourses ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-surface-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-500 mb-2" />
                        Loading courses catalogue...
                      </td>
                    </tr>
                  ) : pagedCourses.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-surface-400">
                        No courses found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    pagedCourses.map((c) => {
                      const lid = c.lecturerId || (c as any).lecturer_id;
                      const lecturer = lid ? lecturerMap.get(lid) : null;
                      const isDept =
                        c.courseType?.toLowerCase() === 'departmental' || c.courseType?.toLowerCase() === 'dept';
                      const isCore = c.subcategory?.toLowerCase() === 'core';
                      const isSelected = selectedCourseIds.has(c.id);

                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors ${
                            isSelected ? 'bg-primary-50/30 dark:bg-primary-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCourse(c.id)}
                              className="rounded border-surface-300 dark:border-surface-600 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="py-3 px-4 font-bold text-surface-900 dark:text-white">{c.code}</td>
                          <td className="py-3 px-4 font-medium text-surface-800 dark:text-surface-200 max-w-xs truncate">
                            {c.title}
                          </td>
                          <td className="py-3 px-4 font-bold text-surface-900 dark:text-white">
                            {c.creditUnits || c.unit || 3}
                          </td>
                          <td className="py-3 px-4 text-surface-600 dark:text-surface-400">{c.level}</td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isDept
                                  ? 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                                  : 'border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-400 bg-surface-100/50 dark:bg-surface-800/30'
                              }`}
                            >
                              {isDept ? 'Dept' : 'Non-Dept'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-surface-600 dark:text-surface-400">
                            {isCore ? 'Core' : 'Elective'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-emerald-500 font-semibold flex items-center gap-1 text-[11px]">
                              <Check className="w-3.5 h-3.5" /> Active
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {lecturer ? (
                              <span className="font-medium text-surface-800 dark:text-surface-200">
                                {lecturer.firstName
                                  ? `${lecturer.firstName} ${lecturer.lastName || ''}`.trim()
                                  : lecturer.email}
                              </span>
                            ) : (
                              <span className="text-surface-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5 relative">
                              <button
                                type="button"
                                onClick={() => handleOpenAssignModal(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-colors"
                              >
                                <UserCheck className="w-3.5 h-3.5 text-primary-500" />
                                Assign
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuCourseId(activeMenuCourseId === c.id ? null : c.id);
                                }}
                                className="w-7 h-7 rounded-lg border border-surface-300 dark:border-surface-700 flex items-center justify-center text-surface-400 hover:text-surface-800 dark:hover:text-white transition-colors"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {/* Action dropdown menu */}
                              {activeMenuCourseId === c.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-8 w-40 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-xl z-30 py-1 overflow-hidden animate-scale-in text-left"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuCourseId(null);
                                      handleArchiveCourse(c);
                                    }}
                                    className="w-full px-3 py-2 text-xs flex items-center gap-2 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-surface-400" />
                                    Archive course
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuCourseId(null);
                                      handleDeleteCourse(c);
                                    }}
                                    className="w-full px-3 py-2 text-xs flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete course
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="py-3 px-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
              <span>
                Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 rounded-lg border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-400 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPage(num)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold ${
                      currentPage === num
                        ? 'bg-primary-600 text-white'
                        : 'border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}

                {totalPages > 5 && <span className="px-1 text-surface-400">...</span>}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="w-7 h-7 rounded-lg border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-600 dark:text-surface-400 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: COURSE ENROLLMENT (FIX STUDENT COURSES)                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'enrollment' && (
        <div className="space-y-5">
          {/* 1. Academic Session & Semester Selection Card */}
          <div className="rounded-2xl p-4 bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                Academic session
              </label>
              <div className="relative">
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full appearance-none text-xs font-medium px-4 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 pr-10"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  {sessions.length === 0 && <option value="">2026/2027</option>}
                </select>
                <ChevronDown className="w-4 h-4 text-surface-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                Semester
              </label>
              <div className="relative">
                <select
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                  className="w-full appearance-none text-xs font-medium px-4 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 pr-10"
                >
                  {semesters.map((sm) => (
                    <option key={sm.id} value={sm.id}>
                      {sm.name.toLowerCase().includes('semester') ? sm.name : `${sm.name} semester`}
                    </option>
                  ))}
                  {semesters.length === 0 && <option value="">First semester</option>}
                </select>
                <ChevronDown className="w-4 h-4 text-surface-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 2. When a Student is Selected */}
          {selectedStudent ? (
            <div className="space-y-5">
              {/* Student Profile Card */}
              <div className="rounded-2xl p-5 bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 flex-wrap">
                  {/* Initials Avatar */}
                  <div className="w-12 h-12 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-sm shrink-0 uppercase shadow-inner">
                    {getInitials(selectedStudent.full_name || (selectedStudent as any).fullName)}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-surface-900 dark:text-white leading-tight">
                      {selectedStudent.full_name || (selectedStudent as any).fullName || '—'}
                    </h3>
                    <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                      {selectedStudent.matric_number || (selectedStudent as any).matricNumber || '—'} · Level{' '}
                      {selectedStudent.level || '—'}
                    </p>
                  </div>

                  {/* Status Pills */}
                  <div className="flex items-center gap-2 ml-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                      <Check className="w-3 h-3 text-emerald-500" />
                      Dues paid
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                      Registered by student
                    </span>
                  </div>
                </div>

                {/* Change Student Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setStagedAdditions([]);
                    setStagedRemovals(new Set());
                    setChangeReason('');
                    setStudentSearchInput('');
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors shadow-sm shrink-0"
                >
                  Change student
                </button>
              </div>

              {/* Two-Column Editor Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* ── LEFT COLUMN: Registered Courses & Add Course ────── */}
                <div className="lg:col-span-8 space-y-5">
                  {/* Registered Courses Card */}
                  <div className="rounded-2xl p-5 bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-surface-900 dark:text-white">Registered courses</h3>
                        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                          {currentSessionName} · {currentSemesterName}
                        </p>
                      </div>
                      <span className="text-xs text-surface-400 dark:text-surface-500">
                        {displayCourseCount} {displayCourseCount === 1 ? 'course' : 'courses'}
                      </span>
                    </div>

                    {loadingStudentCourses ? (
                      <div className="py-8 text-center text-xs text-surface-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary-500 mb-2" />
                        Loading student courses...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Currently Registered Courses */}
                        {studentRegisteredCourses.map((rc) => {
                          const c = courses.find((item) => item.id === (rc.courseId || rc.course_id));
                          const courseCode = c?.code || rc.course_code || 'COURSE';
                          const courseTitle = c?.title || rc.course_title || 'Course Details';
                          const units = c?.creditUnits || c?.unit || 3;
                          const isStagedRemoval = stagedRemovals.has(rc.id);

                          return (
                            <div
                              key={rc.id}
                              className={`p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                                isStagedRemoval
                                  ? 'bg-red-500/5 dark:bg-red-950/10 border-red-200/60 dark:border-red-900/30'
                                  : 'bg-surface-50/60 dark:bg-surface-800/40 border-surface-200/60 dark:border-surface-800/60'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 flex items-center justify-center shrink-0 border border-surface-200/50 dark:border-surface-700/50">
                                  <BookOpen className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className={`text-xs truncate ${
                                      isStagedRemoval
                                        ? 'line-through text-surface-400 dark:text-surface-500'
                                        : 'text-surface-900 dark:text-white'
                                    }`}
                                  >
                                    <span className="font-bold">{courseCode}</span>{' '}
                                    <span className="font-normal">{courseTitle}</span>
                                  </p>
                                  <p className="text-[11px] text-surface-400 dark:text-surface-500 mt-0.5">
                                    Registered by student
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200/60 dark:border-surface-700/60">
                                  {units} units
                                </span>

                                {isStagedRemoval ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleStageRemove(rc.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    To be removed
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => toggleStageRemove(rc.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 hover:border-red-500 hover:text-red-500 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Staged Additions */}
                        {stagedAdditions.map((c) => (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-xl border border-primary-500/30 bg-primary-500/5 dark:bg-primary-950/10 flex items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                <Plus className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-surface-900 dark:text-white truncate">
                                  <span className="font-bold">{c.code}</span>{' '}
                                  <span className="font-normal">{c.title}</span>
                                </p>
                                <p className="text-[11px] text-surface-400 dark:text-surface-500 mt-0.5">
                                  To be added by you
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200/60 dark:border-surface-700/60">
                                {c.creditUnits || c.unit || 3} units
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveStagedAddition(c.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                New
                              </button>
                            </div>
                          </div>
                        ))}

                        {studentRegisteredCourses.length === 0 && stagedAdditions.length === 0 && (
                          <p className="py-6 text-center text-xs text-surface-400 italic">
                            No courses currently registered for this student. Add courses below.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Add a Course Card */}
                  <div className="rounded-2xl p-5 bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-surface-900 dark:text-white">Add a course</h3>

                    <div className="relative">
                      <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search by code or title"
                        value={searchAddCourse}
                        onChange={(e) => setSearchAddCourse(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-surface-400"
                      />
                    </div>

                    <div className="space-y-2">
                      {availableCoursesToAdd.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl border border-surface-100 dark:border-surface-800 bg-surface-50/40 dark:bg-surface-800/20 flex items-center justify-between gap-3"
                        >
                          <p className="text-xs text-surface-900 dark:text-white truncate">
                            <span className="font-bold">{c.code}</span>{' '}
                            <span className="font-normal text-surface-600 dark:text-surface-300">{c.title}</span>
                          </p>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[11px] font-medium text-surface-500 dark:text-surface-400">
                              {c.creditUnits || c.unit || 3} units
                            </span>

                            <button
                              type="button"
                              onClick={() => handleStageAddCourse(c)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 hover:bg-primary-50 dark:hover:bg-primary-950/20 hover:border-primary-500 hover:text-primary-500 text-surface-800 dark:text-surface-200 transition-colors shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                      ))}

                      {availableCoursesToAdd.length === 0 && (
                        <p className="py-4 text-center text-xs text-surface-400">
                          No additional courses available to add.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN: Units & Save Changes ─────────────── */}
                <div className="lg:col-span-4 space-y-5">
                  {/* Units Card */}
                  <div className="rounded-2xl p-5 bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm">
                    <h3 className="text-sm font-bold text-surface-900 dark:text-white">Units</h3>
                    <div className="flex items-baseline justify-between mt-3">
                      <span className="text-xs text-surface-500 dark:text-surface-400">After your changes</span>
                      <div>
                        <span className="text-3xl font-bold text-surface-900 dark:text-white tracking-tight">
                          {totalUnitsAfterChanges}
                        </span>
                        <span className="text-sm font-semibold text-surface-400 dark:text-surface-500"> / 24</span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden mt-3">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isUnitsValid ? 'bg-primary-600' : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, (totalUnitsAfterChanges / 24) * 100))}%`,
                        }}
                      />
                    </div>

                    <div className="mt-3">
                      {isUnitsValid ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" />
                          Within the 4 to 24 unit range
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Outside the 4 to 24 unit range
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save Changes Card */}
                  <div className="rounded-2xl p-5 bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-surface-900 dark:text-white">Save changes</h3>
                      <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
                        {stagedAdditions.length} added, {stagedRemovals.size} removed
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                        Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        placeholder="Student registered GET 501 by mistake and missed CPE 509."
                        className="w-full text-xs p-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none placeholder-surface-400"
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        disabled={
                          savingChanges ||
                          (stagedAdditions.length === 0 && stagedRemovals.size === 0) ||
                          !changeReason.trim()
                        }
                        onClick={handleSaveChanges}
                        className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingChanges ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Saving changes...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Save changes
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={
                          savingChanges || (stagedAdditions.length === 0 && stagedRemovals.size === 0 && !changeReason)
                        }
                        onClick={handleDiscardChanges}
                        className="w-full py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        Discard
                      </button>
                    </div>

                    <p className="text-[11px] text-surface-400 dark:text-surface-500 leading-relaxed pt-1">
                      The student is notified. The change and your reason are saved in the audit log.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 3. When NO Student is Selected: Search & Selection Card */
            <div className="rounded-2xl p-6 bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-surface-900 dark:text-white">Find a student</h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Search by matric number or name to manage student course enrollments.
                  </p>
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={studentSearchInput}
                  onChange={(e) => handleSearchStudent(e.target.value)}
                  placeholder="Type a matric number or student name..."
                  className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                {studentSearching && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}

                {/* Autocomplete Dropdown */}
                {searchedStudents.length > 0 && (
                  <div className="absolute top-12 left-0 right-0 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-2xl z-20 py-1 max-h-56 overflow-y-auto">
                    {searchedStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectStudent(s)}
                        className="w-full text-left px-4 py-2.5 text-xs hover:bg-surface-50 dark:hover:bg-surface-800 flex items-center justify-between transition-colors border-b last:border-0 border-surface-100 dark:border-surface-800"
                      >
                        <div>
                          <p className="font-semibold text-surface-900 dark:text-white">
                            {s.full_name || (s as any).fullName}
                          </p>
                          <p className="text-[11px] text-surface-400">
                            {s.matric_number || (s as any).matricNumber || 'Matric unknown'}
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
                          Level {s.level || '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Suggestions when no active search query */}
              {suggestedStudents.length > 0 && !studentSearchInput && (
                <div className="space-y-2 pt-2 border-t border-surface-100 dark:border-surface-800">
                  <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">Recent Students</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {suggestedStudents.slice(0, 6).map((stu) => (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() => handleSelectStudent(stu)}
                        className="text-left p-3 rounded-xl border border-surface-200/70 dark:border-surface-800 hover:border-primary-500 bg-surface-50/50 dark:bg-surface-800/40 hover:bg-white dark:hover:bg-surface-800 transition-all flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                          {getInitials(stu.full_name || (stu as any).fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-surface-900 dark:text-white truncate">
                            {stu.full_name || (stu as any).fullName}
                          </p>
                          <p className="text-[10px] text-surface-400 truncate">
                            {stu.matric_number || (stu as any).matricNumber || 'Matric unknown'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SLIDEOVER DRAWER: CREATE COURSE                                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-surface-900 shadow-2xl h-full flex flex-col justify-between animate-slide-left p-6 overflow-y-auto">
            <form onSubmit={handleCreateCourse} className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-white">Create course</h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Add a course to the department catalogue
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateDrawerOpen(false)}
                  className="w-8 h-8 rounded-full border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-400 hover:text-surface-800 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 2-col inputs: Code & Title */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Course code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CPE 501"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Advanced Digital Systems"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* 2-col: Units stepper & Level select */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Credit units
                  </label>
                  <div className="flex items-center justify-between border border-surface-300 dark:border-surface-700 rounded-xl px-3 py-1.5 bg-surface-50 dark:bg-surface-800">
                    <button
                      type="button"
                      onClick={() => setNewUnits((u) => Math.max(1, u - 1))}
                      className="text-surface-500 hover:text-surface-900 dark:hover:text-white p-0.5"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-surface-900 dark:text-white">{newUnits}</span>
                    <button
                      type="button"
                      onClick={() => setNewUnits((u) => Math.min(6, u + 1))}
                      className="text-surface-500 hover:text-surface-900 dark:hover:text-white p-0.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                    Level
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(Number(e.target.value))}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none"
                  >
                    <option value={100}>100 Level</option>
                    <option value={200}>200 Level</option>
                    <option value={300}>300 Level</option>
                    <option value={400}>400 Level</option>
                    <option value={500}>500 Level</option>
                  </select>
                </div>
              </div>

              {/* Semester Segmented Pill */}
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                  Semester
                </label>
                <div className="p-1 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center gap-1 border border-surface-200 dark:border-surface-700">
                  {(['First', 'Second'] as const).map((sem) => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => setNewSemester(sem)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        newSemester === sem
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                      }`}
                    >
                      {sem}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Segmented Pill: Dept | Non-Dept */}
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                  Type
                </label>
                <div className="p-1 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center gap-1 border border-surface-200 dark:border-surface-700">
                  {(['Dept', 'Non-Dept'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        newType === t
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Role in programme: Core | Elective */}
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                  Role in the programme
                </label>
                <div className="p-1 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center gap-1 border border-surface-200 dark:border-surface-700">
                  {(['Core', 'Elective'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        newRole === r
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lecturer (optional) */}
              <div>
                <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                  Lecturer (optional)
                </label>
                <select
                  value={newLecturerId}
                  onChange={(e) => setNewLecturerId(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none"
                >
                  <option value="">Select a lecturer</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName ? `${l.firstName} ${l.lastName || ''}`.trim() : l.email}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-surface-400 mt-1">You can assign one later.</p>
              </div>

              {/* Footer */}
              <div className="pt-6 border-t border-surface-100 dark:border-surface-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateDrawerOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCourse}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50"
                >
                  {submittingCourse ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                  Create course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ASSIGN LECTURER MODAL ────────────────────────────────────────── */}
      {assignModalOpen && assigningCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-surface-900 dark:text-white">
                  Assign Lecturer to {assigningCourse.code}
                </h3>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">{assigningCourse.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="p-1 rounded-lg text-surface-400 hover:text-surface-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1.5">
                Select lecturer
              </label>
              <select
                value={assignedLecturerId}
                onChange={(e) => setAssignedLecturerId(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white focus:outline-none"
              >
                <option value="">Choose a lecturer...</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.firstName ? `${l.firstName} ${l.lastName || ''}`.trim() : l.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assigningSaving || !assignedLecturerId}
                onClick={handleSaveLecturerAssignment}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50"
              >
                {assigningSaving ? 'Saving...' : 'Confirm assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LECTURER ASSIGNMENTS DRAWER ─────────────────────────────────── */}
      {lecturerAssignmentsOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-surface-900 shadow-2xl h-full flex flex-col justify-between animate-slide-left p-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-white">Lecturer assignments</h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    Overview of courses allocated per lecturer
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLecturerAssignmentsOpen(false)}
                  className="w-8 h-8 rounded-full border border-surface-200 dark:border-surface-700 flex items-center justify-center text-surface-400 hover:text-surface-800 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {lecturers.map((l) => {
                  const assigned = courses.filter((c) => c.lecturerId === l.id || (c as any).lecturer_id === l.id);
                  return (
                    <div key={l.id} className="py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold text-surface-900 dark:text-white">
                          {l.firstName ? `${l.firstName} ${l.lastName || ''}`.trim() : l.email}
                        </p>
                        <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
                          {assigned.length} {assigned.length === 1 ? 'course' : 'courses'}
                        </span>
                      </div>
                      {assigned.length === 0 ? (
                        <p className="text-[11px] text-surface-400 italic">No courses assigned</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {assigned.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300"
                            >
                              {c.code}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-surface-100 dark:border-surface-800">
              <button
                type="button"
                onClick={() => setLecturerAssignmentsOpen(false)}
                className="w-full px-4 py-2 text-xs font-semibold rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-900 dark:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
