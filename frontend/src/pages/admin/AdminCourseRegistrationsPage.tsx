import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { getCourses } from '../../api/courses';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import {
  getStudentRegistrations,
  getRegisteredCourses,
  createRegistration,
  addCourseToRegistration,
  removeCourseFromRegistration,
  updateRegistrationStatus,
  deleteCourseRegistration,
} from '../../api/course-registrations';
import { searchStudentsForRoles } from '../../api/role-management';
import { useNotification } from '../../hooks/useNotification';
import {
  BookOpen,
  User,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Calendar,
  Layers,
  Filter,
  AlertCircle,
  X,
  ShieldCheck,
} from 'lucide-react';
import type { Course, AcademicSession, SemesterEntry, StudentForRoleManagement } from '../../types';
import { getErrorMessage } from '../../utils/errors';

type StudentRegistration = Awaited<ReturnType<typeof getStudentRegistrations>>[number];
type RegisteredCourseRecord = Awaited<ReturnType<typeof getRegisteredCourses>>[number];

function isSameSemester(courseSemester?: string, selectedSemesterName?: string): boolean {
  if (!selectedSemesterName || !courseSemester) return true;
  const cSem = courseSemester.toLowerCase().trim();
  const sSem = selectedSemesterName.toLowerCase().trim();

  const isFirstC = cSem.includes('first') || cSem.includes('harmattan') || cSem === '1';
  const isFirstS = sSem.includes('first') || sSem.includes('harmattan') || sSem === '1';

  const isSecondC = cSem.includes('second') || cSem.includes('rain') || cSem === '2';
  const isSecondS = sSem.includes('second') || sSem.includes('rain') || sSem === '2';

  if (isFirstS) return isFirstC;
  if (isSecondS) return isSecondC;
  return true;
}

const AdminCourseRegistrationsPage = () => {
  const { success, error: notifyError } = useNotification();

  // Session & Semester selection state
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [semesters, setSemesters] = useState<SemesterEntry[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');

  // Student list & search state
  const [students, setStudents] = useState<StudentForRoleManagement[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentForRoleManagement | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState<boolean>(false);

  // Courses & Registrations state
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allStudentRegistrations, setAllStudentRegistrations] = useState<StudentRegistration[]>([]);
  const [registeredCourses, setRegisteredCourses] = useState<RegisteredCourseRecord[]>([]);

  // Loading states
  const [loadingMeta, setLoadingMeta] = useState<boolean>(false);
  const [loadingRegs, setLoadingRegs] = useState<boolean>(false);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);

  // Modal states
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [selectedCourseIdToAdd, setSelectedCourseIdToAdd] = useState('');
  const [submittingAddCourse, setSubmittingAddCourse] = useState(false);
  const [submittingCreateReg, setSubmittingCreateReg] = useState(false);

  // 1. Initial metadata fetch: sessions, courses, students
  const fetchMetadata = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [sessRes, crsRes, stuRes] = await Promise.all([
        getSessions({ page: 1, perPage: 50 }).catch(() => []),
        getCourses().catch(() => []),
        searchStudentsForRoles({ per_page: 500 }).catch(() => ({ data: [] })),
      ]);

      const sessList = Array.isArray(sessRes) ? sessRes : [];
      setSessions(sessList);
      if (sessList.length > 0 && !selectedSession) {
        setSelectedSession(sessList[0].id);
      }

      setAllCourses(Array.isArray(crsRes) ? crsRes : []);
      setStudents(Array.isArray(stuRes.data) ? stuRes.data : []);
    } catch {
      notifyError('Error', 'Failed to load initial session and course metadata');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // 2. Fetch semesters whenever selectedSession changes
  useEffect(() => {
    if (!selectedSession) {
      setSemesters([]);
      setSelectedSemester('');
      return;
    }
    listSessionSemesters(selectedSession)
      .then((res) => {
        const semsList = Array.isArray(res) ? res : [];
        setSemesters(semsList);
        if (semsList.length > 0) {
          setSelectedSemester(semsList[0].id);
        } else {
          setSelectedSemester('');
        }
      })
      .catch(() => {
        setSemesters([]);
        setSelectedSemester('');
      });
  }, [selectedSession]);

  // 3. Load registrations for the selected student
  const loadStudentRegistrations = useCallback(async (studentId: string) => {
    setLoadingRegs(true);
    try {
      const regs = await getStudentRegistrations(studentId);
      setAllStudentRegistrations(regs);
    } catch {
      notifyError('Error', 'Could not fetch course registrations for selected student');
      setAllStudentRegistrations([]);
    } finally {
      setLoadingRegs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudent?.student_id) {
      loadStudentRegistrations(selectedStudent.student_id);
    } else {
      setAllStudentRegistrations([]);
      setRegisteredCourses([]);
    }
  }, [selectedStudent, loadStudentRegistrations]);

  // 4. Resolve current session & semester registration record
  const currentRegistration = allStudentRegistrations.find(
    (r) => r.session_id === selectedSession && r.semester_id === selectedSemester,
  );

  // 5. Load registered courses whenever currentRegistration changes
  const loadRegistrationCourses = useCallback(async (regId: string) => {
    setLoadingCourses(true);
    try {
      const courses = await getRegisteredCourses(regId);
      setRegisteredCourses(courses);
    } catch {
      notifyError('Error', 'Failed to load course details for this registration');
      setRegisteredCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    if (currentRegistration?.id) {
      loadRegistrationCourses(currentRegistration.id);
    } else {
      setRegisteredCourses([]);
    }
  }, [currentRegistration?.id, loadRegistrationCourses]);

  // Handlers for creating registration, adding/removing courses, approving status
  const handleCreateRegistration = async () => {
    if (!selectedStudent || !selectedSession || !selectedSemester) {
      notifyError('Missing Selection', 'Please select a session, semester, and student first');
      return;
    }

    setSubmittingCreateReg(true);
    try {
      await createRegistration({
        student_id: selectedStudent.student_id,
        session_id: selectedSession,
        semester_id: selectedSemester,
        status: 'approved',
      });
      success('Registration Initialized', 'Created course registration header for this semester');
      await loadStudentRegistrations(selectedStudent.student_id);
    } catch (err) {
      notifyError('Initialization Error', getErrorMessage(err, 'Could not create course registration'));
    } finally {
      setSubmittingCreateReg(false);
    }
  };

  const handleAddCourse = async () => {
    if (!selectedCourseIdToAdd) {
      notifyError('Missing Course', 'Please select a course to add');
      return;
    }

    let targetRegId = currentRegistration?.id;

    setSubmittingAddCourse(true);
    try {
      // Auto-create registration header if it doesn't exist yet
      if (!targetRegId) {
        if (!selectedStudent || !selectedSession || !selectedSemester) {
          notifyError('Error', 'Required fields missing to initialize registration');
          setSubmittingAddCourse(false);
          return;
        }
        const newReg = await createRegistration({
          student_id: selectedStudent.student_id,
          session_id: selectedSession,
          semester_id: selectedSemester,
          status: 'approved',
        });
        targetRegId = newReg.id;
      }

      await addCourseToRegistration(targetRegId, {
        course_id: selectedCourseIdToAdd,
        status: 'enrolled',
      });

      success('Course Enrolled', 'Course added to student registration record');
      setIsAddCourseModalOpen(false);
      setSelectedCourseIdToAdd('');
      if (selectedStudent?.student_id) {
        await loadStudentRegistrations(selectedStudent.student_id);
      }
      if (targetRegId) {
        await loadRegistrationCourses(targetRegId);
      }
    } catch (err) {
      notifyError('Enrollment Error', getErrorMessage(err, 'Failed to add course to registration'));
    } finally {
      setSubmittingAddCourse(false);
    }
  };

  const handleRemoveCourse = async (registeredCourseId: string) => {
    if (!currentRegistration?.id) return;
    if (!confirm('Are you sure you want to remove this course from student registration?')) return;
    try {
      await removeCourseFromRegistration(currentRegistration.id, registeredCourseId);
      success('Course Removed', 'Course removed from student registration');
      if (selectedStudent?.student_id) {
        loadStudentRegistrations(selectedStudent.student_id);
      }
      loadRegistrationCourses(currentRegistration.id);
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to remove course'));
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!currentRegistration?.id) return;
    try {
      await updateRegistrationStatus(currentRegistration.id, newStatus);
      success('Status Updated', `Registration status set to ${newStatus.toUpperCase()}`);
      if (selectedStudent?.student_id) {
        loadStudentRegistrations(selectedStudent.student_id);
      }
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to update registration status'));
    }
  };

  const handleDeleteRegistration = async (regIdToDelete?: string) => {
    const targetId = regIdToDelete || currentRegistration?.id;
    if (!targetId) return;
    if (!confirm('Are you sure you want to delete this course registration header and all enrolled courses within it?'))
      return;
    try {
      await deleteCourseRegistration(targetId);
      success('Registration Deleted', 'Course registration header deleted successfully');
      setRegisteredCourses([]);
      if (selectedStudent?.student_id) {
        await loadStudentRegistrations(selectedStudent.student_id);
      }
    } catch (err) {
      notifyError('Error', getErrorMessage(err, 'Failed to delete course registration'));
    }
  };

  // Filter student list for dropdown
  const filteredStudents = students
    .filter((s) => {
      if (!studentSearch || studentSearch.length < 2) return false;
      const q = studentSearch.toLowerCase();
      const name = (s.full_name || s.email || '').toLowerCase();
      const matric = (s.matric_number || '').toLowerCase();
      return name.includes(q) || matric.includes(q);
    })
    .slice(0, 20);

  // Find semester object and filter courses for the selected semester
  const selectedSemObj = semesters.find((s) => s.id === selectedSemester);
  const selectedSemName = selectedSemObj?.name || '';
  const selectedSessObj = sessions.find((s) => s.id === selectedSession);

  const availableCoursesForSemester = allCourses.filter((c) => isSameSemester(c.semester, selectedSemName));

  return (
    <div className="space-y-6">
      {/* Session & Semester Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary-500" />
            Session & Semester Filter
          </CardTitle>
          <CardDescription>Select the session and semester to manage student course enrollments</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Academic Session"
              options={sessions.map((s) => ({ value: s.id, label: s.name }))}
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              placeholder={loadingMeta ? 'Loading sessions...' : 'Select session'}
            />
            <Select
              label="Semester"
              options={semesters.map((s) => ({ value: s.id, label: `${s.name.toUpperCase()} SEMESTER` }))}
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              placeholder={!selectedSession ? 'Select session first' : 'Select semester'}
              disabled={!selectedSession}
            />
          </div>
        </div>
      </Card>

      {/* Student Selector Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            Select Student
          </CardTitle>
          <CardDescription>Search by matric number or student name</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Type matric number or student name..."
                value={
                  selectedStudent
                    ? `${selectedStudent.matric_number || 'No Matric'} — ${selectedStudent.full_name || selectedStudent.email}`
                    : studentSearch
                }
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setSelectedStudent(null);
                  setShowStudentDropdown(true);
                }}
                onFocus={() => {
                  if (!selectedStudent) setShowStudentDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
                disabled={!!selectedStudent}
                className="w-full pl-10 pr-10 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-80 font-medium"
              />
              {selectedStudent && (
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showStudentDropdown && !selectedStudent && filteredStudents.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors border-b border-surface-100 dark:border-surface-700/50 last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedStudent(s);
                      setStudentSearch('');
                      setShowStudentDropdown(false);
                    }}
                  >
                    <p className="text-sm font-semibold text-surface-900 dark:text-white">
                      {s.matric_number ? s.matric_number : 'Pending Matric'}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{s.full_name || s.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Registration Details for Selected Student */}
      {!selectedStudent ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
          <h3 className="font-bold text-lg text-surface-700 dark:text-surface-200">No Student Selected</h3>
          <p className="text-sm text-surface-500 max-w-md mx-auto mt-1">
            Use the student search bar above to select a student and view/manage their course enrollment for the chosen
            session and semester.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Session & Semester Enrollment Header */}
          <Card glass className="p-5 border-l-4 border-l-primary-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {selectedSessObj?.name || 'Session'} &middot;{' '}
                  {selectedSemName ? `${selectedSemName.toUpperCase()} SEMESTER` : 'Semester'}
                </div>
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                  {selectedStudent.full_name || selectedStudent.email}
                </h2>
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 font-mono">
                  Matric: {selectedStudent.matric_number || 'N/A'} | Level: {selectedStudent.level || '—'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {currentRegistration ? (
                  <>
                    <Badge
                      variant={
                        currentRegistration.status === 'approved'
                          ? 'success'
                          : currentRegistration.status === 'submitted'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      Status: {currentRegistration.status.toUpperCase()}
                    </Badge>
                    <Button
                      size="sm"
                      variant="danger"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={() => handleDeleteRegistration()}
                      title="Delete this entire registration header"
                    >
                      Delete Header
                    </Button>
                  </>
                ) : (
                  <Badge variant="default">NOT REGISTERED THIS SEMESTER</Badge>
                )}

                <Button
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsAddCourseModalOpen(true)}
                  disabled={!selectedSemester}
                >
                  Add Course
                </Button>
              </div>
            </div>
          </Card>

          {/* Registration Details & Courses Table */}
          {loadingRegs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500 mr-2" />
              <span className="text-sm text-surface-500">Loading student registration...</span>
            </div>
          ) : !currentRegistration ? (
            <Card className="p-8 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-warning-500 mx-auto" />
              <div>
                <h4 className="font-semibold text-surface-800 dark:text-surface-200">No Course Registration Record</h4>
                <p className="text-xs text-surface-500 mt-1 max-w-md mx-auto">
                  There is no registered course record for this student in{' '}
                  {selectedSessObj?.name || 'the selected session'} ({selectedSemName || 'selected semester'}).
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={
                    submittingCreateReg ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )
                  }
                  onClick={handleCreateRegistration}
                  isLoading={submittingCreateReg}
                >
                  Initialize Course Registration Header
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsAddCourseModalOpen(true)}
                >
                  Directly Add Course
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Enrolled Courses
                    <span className="text-xs font-mono text-surface-500 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full">
                      Total Units: {currentRegistration.total_units || 0}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Courses registered for {selectedSessObj?.name} &middot; {selectedSemName.toUpperCase()} SEMESTER
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {currentRegistration.status !== 'approved' && (
                    <Button
                      size="xs"
                      variant="success"
                      leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                      onClick={() => handleStatusChange('approved')}
                    >
                      Approve Header
                    </Button>
                  )}
                  {currentRegistration.status !== 'rejected' && (
                    <Button
                      size="xs"
                      variant="danger"
                      leftIcon={<XCircle className="w-3.5 h-3.5" />}
                      onClick={() => handleStatusChange('rejected')}
                    >
                      Reject Header
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="danger"
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handleDeleteRegistration()}
                  >
                    Delete Registration
                  </Button>
                </div>
              </CardHeader>

              <div className="p-4 pt-0">
                {loadingCourses ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500 mr-2" />
                    <span className="text-xs text-surface-500">Loading course roster...</span>
                  </div>
                ) : registeredCourses.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-surface-200 dark:border-surface-700 rounded-lg">
                    <p className="text-xs text-surface-400 mb-3">No courses added to this registration yet.</p>
                    <Button
                      size="xs"
                      variant="outline"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => setIsAddCourseModalOpen(true)}
                    >
                      Add First Course
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700">
                          <th className="px-3 py-2">Course Code</th>
                          <th className="px-3 py-2">Course Title</th>
                          <th className="px-3 py-2">Level</th>
                          <th className="px-3 py-2">Units</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                        {registeredCourses.map((rc) => {
                          const matchedCourse = allCourses.find((c) => c.id === rc.course_id);
                          return (
                            <tr
                              key={rc.id}
                              className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                            >
                              <td className="px-3 py-2.5 font-bold font-mono text-surface-900 dark:text-white">
                                {matchedCourse?.code || rc.course_id.slice(0, 8)}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-surface-700 dark:text-surface-300">
                                {matchedCourse?.title || 'Unknown Course'}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-surface-500">
                                {matchedCourse?.level ? `${matchedCourse.level}L` : '—'}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs">{matchedCourse?.unit ?? '-'}</td>
                              <td className="px-3 py-2.5">
                                <Badge variant={rc.status === 'enrolled' ? 'info' : 'default'}>{rc.status}</Badge>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  onClick={() => handleRemoveCourse(rc.id)}
                                  className="p-1.5 text-danger-500 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-950/40 rounded transition-all"
                                  title="Remove course from registration"
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
            </Card>
          )}

          {/* All Session History Accordion / Quick List */}
          {allStudentRegistrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-surface-600 dark:text-surface-400">
                  <Layers className="w-4 h-4" />
                  All Student Registration Records ({allStudentRegistrations.length})
                </CardTitle>
              </CardHeader>
              <div className="p-4 pt-0">
                <div className="flex flex-wrap gap-2">
                  {allStudentRegistrations.map((reg) => {
                    const sess = sessions.find((s) => s.id === reg.session_id);
                    const isSelectedReg = reg.id === currentRegistration?.id;
                    return (
                      <div key={reg.id} className="relative group flex items-center">
                        <button
                          onClick={() => {
                            setSelectedSession(reg.session_id);
                            setSelectedSemester(reg.semester_id);
                          }}
                          className={`px-3 py-2 pr-7 rounded-lg text-xs font-medium border transition-all text-left ${
                            isSelectedReg
                              ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-600 dark:text-primary-400 font-semibold shadow-sm'
                              : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-100'
                          }`}
                        >
                          <p>{sess?.name || 'Session'}</p>
                          <p className="text-[10px] text-surface-400">Status: {reg.status}</p>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRegistration(reg.id);
                          }}
                          className="absolute right-1.5 p-1 text-surface-400 hover:text-danger-500 rounded transition-colors"
                          title="Delete this registration record"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Add Course Modal */}
      <Modal
        isOpen={isAddCourseModalOpen}
        onClose={() => setIsAddCourseModalOpen(false)}
        title={`Add Course to Registration (${selectedSemName.toUpperCase()} SEMESTER)`}
      >
        <div className="space-y-4">
          <p className="text-xs text-surface-500">
            Select a course to enroll for{' '}
            <span className="font-semibold">{selectedStudent?.full_name || selectedStudent?.email}</span> in{' '}
            {selectedSessObj?.name} ({selectedSemName.toUpperCase()}).
          </p>

          <Select
            label="Course (Filtered by Selected Semester)"
            value={selectedCourseIdToAdd}
            onChange={(e) => setSelectedCourseIdToAdd(e.target.value)}
            options={[
              { value: '', label: '-- Select a course --' },
              ...availableCoursesForSemester.map((c) => ({
                value: c.id,
                label: `${c.code} — ${c.title} (${c.unit} units) [${(c.semester || '').toUpperCase()}]`,
              })),
            ]}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsAddCourseModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" isLoading={submittingAddCourse} onClick={handleAddCourse}>
              Enroll Course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminCourseRegistrationsPage;
