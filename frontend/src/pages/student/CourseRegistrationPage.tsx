import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { getCoursesByLevelAndSemester } from '../../api/courses';
import {
  submitRegistration,
  getActiveSessionAndSemester,
  getMyRegisteredCourseIDs,
  getStudentRegistrations,
} from '../../api/course-registrations';
import type { RawSession, RawSemester } from '../../api/course-registrations';
import { getMyDues, checkDuePaid } from '../../api/payments';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Check, Plus, AlertCircle, Save, BookOpen, RefreshCw, ClipboardList, CreditCard } from 'lucide-react';
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
  registered_courses?: RegisteredCourseRow[];
}

type UserWithStudentId = User & { studentId?: string; student_id?: string };

const CourseRegistrationPage = () => {
  const { success, warning, error: notifyError } = useNotification();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('register');

  // Register tab state
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [registeredCourseIds, setRegisteredCourseIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semesterInfo, setSemesterInfo] = useState<{ session: RawSession | null; semester: RawSemester | null }>({
    session: null,
    semester: null,
  });
  const [loadError, setLoadError] = useState(false);
  const [unpaidDues, setUnpaidDues] = useState<string[]>([]);
  const [duesChecked, setDuesChecked] = useState(false);

  // Registrations tab state
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);

  const studentLevel = user?.level || 100;

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
      const [courseList, regIds] = await Promise.all([
        getCoursesByLevelAndSemester(studentLevel, semName),
        getMyRegisteredCourseIDs().catch(() => []),
      ]);
      setCourses(courseList);
      setRegisteredCourseIds(new Set(regIds));
    } catch {
      setLoadError(true);
      notifyError('Error', 'Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [studentLevel, notifyError]);

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

  // Surface the same dept/class dues gate the backend enforces on submit —
  // proactively, before the student even picks courses, so they aren't
  // surprised by a "Registration Failed" toast after doing all that work.
  useEffect(() => {
    let cancelled = false;
    const checkDues = async () => {
      try {
        const dues = await getMyDues(studentLevel);
        const requiredDues = dues.filter((d) => d.is_active && (d.type === 'dept_dues' || d.type === 'class_dues'));
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
        // if the dues check itself fails, don't block the page on it —
        // the backend still enforces the gate on actual submit
      } finally {
        if (!cancelled) setDuesChecked(true);
      }
    };
    checkDues();
    return () => {
      cancelled = true;
    };
  }, [studentLevel]);

  useEffect(() => {
    if (activeTab === 'registrations') {
      loadRegistrations();
    }
  }, [activeTab, loadRegistrations]);

  const toggleCourse = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const availableCourses = courses.filter((c) => !registeredCourseIds.has(c.id));
  const selectedCourses = availableCourses.filter((c) => selectedIds.includes(c.id));
  const totalUnits = selectedCourses.reduce((sum, c) => sum + c.unit, 0);
  const minUnits = 4;
  const maxUnits = 24;
  const canSubmit =
    totalUnits >= minUnits &&
    totalUnits <= maxUnits &&
    selectedCourses.length > 0 &&
    !submitting &&
    unpaidDues.length === 0;

  const handleSubmit = async () => {
    if (!semesterInfo.session || !semesterInfo.semester) {
      notifyError('Error', 'No active session/semester found.');
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
      loadCourses();
    } catch (err) {
      notifyError('Registration Failed', getErrorMessage(err, 'Failed to submit registration.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Registration</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {semesterInfo.semester
              ? `${semesterInfo.semester.name === 'harmattan' || semesterInfo.semester.name === 'first' ? 'First' : semesterInfo.semester.name === 'rain' || semesterInfo.semester.name === 'second' ? 'Second' : semesterInfo.semester.name || semesterInfo.semester.season || 'Current'} Semester — Level ${studentLevel}`
              : 'Select and register your academic courses for the current semester.'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadCourses();
            if (activeTab === 'registrations') loadRegistrations();
          }}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 pb-px">
        {[
          { key: 'register' as Tab, label: 'Register Courses', icon: BookOpen },
          { key: 'registrations' as Tab, label: 'My Registrations', icon: ClipboardList },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20'
                : 'border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === 'registrations' && registrations.length > 0 && (
              <Badge variant="info" className="ml-1 text-[10px]">
                {registrations.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Register Courses Tab */}
      {activeTab === 'register' && (
        <>
          {duesChecked && unpaidDues.length > 0 && (
            <Card className="p-4 border-danger-500/30 bg-danger-500/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-danger-700 dark:text-danger-400">
                    Outstanding dues must be paid before you can register
                  </p>
                  <p className="text-xs text-danger-600/80 dark:text-danger-400/80 mt-0.5">
                    Unpaid: {unpaidDues.join(', ')}
                  </p>
                </div>
                <Link to="/payments">
                  <Button size="sm" variant="danger" leftIcon={<CreditCard className="w-4 h-4" />}>
                    Go to Payments
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {registeredCourseIds.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-success-500/5 border border-success-500/20 rounded-lg text-xs text-success-600">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {registeredCourseIds.size} course(s) already registered this semester — hidden from the list below.
              </span>
            </div>
          )}

          {loadError && (
            <Card className="p-6 border-danger-500/20 bg-danger-500/5">
              <div className="flex items-center gap-3 text-danger-600">
                <AlertCircle className="w-5 h-5" />
                <div>
                  <p className="font-medium">Unable to load courses</p>
                  <p className="text-sm mt-1">No active semester found or the server is unreachable.</p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Available Courses</CardTitle>
                  <CardDescription>
                    {loading
                      ? 'Loading courses...'
                      : `${availableCourses.length} courses available for Level ${studentLevel} (${registeredCourseIds.size} already registered)`}
                  </CardDescription>
                </CardHeader>
                <div className="divide-y divide-surface-100 dark:divide-surface-800">
                  {loading && (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
                      <span className="ml-2 text-sm text-surface-500">Loading courses...</span>
                    </div>
                  )}
                  {!loading &&
                    availableCourses.map((c) => {
                      const isSelected = selectedIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-surface-900 dark:text-white">{c.code}</span>
                              <Badge
                                variant={
                                  c.courseType === 'core'
                                    ? 'primary'
                                    : c.courseType === 'elective'
                                      ? 'success'
                                      : 'outline'
                                }
                              >
                                {c.courseType || c.subcategory || 'core'}
                              </Badge>
                              {c.prerequisiteId && (
                                <Badge variant="warning" className="text-[10px]">
                                  Prereq
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-surface-500">{c.title}</p>
                            {c.description && (
                              <p className="text-[11px] text-surface-400 mt-0.5 line-clamp-1">{c.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs text-surface-400 font-medium block">{c.unit} Units</span>
                              <span className="text-[10px] text-surface-400 capitalize">{c.semester}</span>
                            </div>
                            <Button
                              size="xs"
                              variant={isSelected ? 'success' : 'outline'}
                              onClick={() => toggleCourse(c.id)}
                              leftIcon={
                                isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />
                              }
                            >
                              {isSelected ? 'Selected' : 'Add'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  {!loading && !loadError && availableCourses.length === 0 && (
                    <EmptyState
                      title={
                        registeredCourseIds.size > 0
                          ? 'All available courses are already registered.'
                          : 'No courses available for registration.'
                      }
                      description={
                        registeredCourseIds.size > 0
                          ? 'Check the "My Registrations" tab to see your registered courses.'
                          : 'Courses may not be set up for your level yet.'
                      }
                    />
                  )}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="p-6 border border-primary-500/20 bg-primary-500/5">
                <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-2">Registration Summary</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Level</span>
                    <span className="font-semibold">{studentLevel}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Selected Courses</span>
                    <span className="font-semibold">{selectedCourses.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Total Credit Units</span>
                    <span
                      className={`font-semibold ${totalUnits < minUnits ? 'text-warning-500' : totalUnits > maxUnits ? 'text-danger-500' : 'text-primary-500'}`}
                    >
                      {totalUnits} / {maxUnits}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Min. Required</span>
                    <span className="font-semibold">{minUnits} units</span>
                  </div>
                </div>

                {totalUnits > maxUnits && (
                  <div className="flex gap-2 p-3 bg-danger-500/10 border border-danger-500/20 text-danger-600 rounded-lg text-xs mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Exceeds maximum of {maxUnits} credit units.</span>
                  </div>
                )}

                {totalUnits < minUnits && totalUnits > 0 && (
                  <div className="flex gap-2 p-3 bg-warning-500/10 border border-warning-500/20 text-warning-600 rounded-lg text-xs mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Minimum {minUnits} credit units required.</span>
                  </div>
                )}

                <Button
                  className="w-full"
                  isLoading={submitting}
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  {submitting ? 'Submitting...' : 'Submit Registration'}
                </Button>
              </Card>

              {selectedCourses.length > 0 && (
                <Card className="p-4">
                  <h4 className="font-medium text-sm text-surface-700 dark:text-surface-300 mb-3">Selected Courses</h4>
                  <div className="space-y-2">
                    {selectedCourses.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0"
                      >
                        <div>
                          <span className="font-medium text-surface-800 dark:text-surface-200">{c.code}</span>
                          <span className="text-surface-400 ml-1.5">{c.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-surface-400">{c.unit}u</span>
                          <button
                            onClick={() => toggleCourse(c.id)}
                            className="text-danger-500 hover:text-danger-600 p-0.5"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* My Registrations Tab */}
      {activeTab === 'registrations' && (
        <div className="space-y-4">
          {loadingRegistrations ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading registrations...</span>
            </div>
          ) : registrations.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                title="No course registrations found."
                description='Switch to the "Register Courses" tab to register for courses.'
              />
            </Card>
          ) : (
            registrations.map((reg, idx: number) => (
              <Card key={reg.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Registration #{registrations.length - idx}
                        <Badge
                          variant={
                            reg.status === 'approved' ? 'success' : reg.status === 'submitted' ? 'warning' : 'default'
                          }
                        >
                          {reg.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {reg.total_units || reg.totalUnits || 0} total units
                        {reg.registered_courses && ` — ${reg.registered_courses.length} course(s)`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                {reg.registered_courses && reg.registered_courses.length > 0 && (
                  <div className="p-4 pt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700">
                            <th className="px-3 py-2">Course ID</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Grade</th>
                            <th className="px-3 py-2">CA Score</th>
                            <th className="px-3 py-2">Exam Score</th>
                            <th className="px-3 py-2">Carryover</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                          {reg.registered_courses.map((rc) => (
                            <tr key={rc.id}>
                              <td className="px-3 py-2 font-mono text-xs">{rc.course_id.slice(0, 8)}...</td>
                              <td className="px-3 py-2">
                                <Badge variant={rc.status === 'enrolled' ? 'info' : 'default'}>{rc.status}</Badge>
                              </td>
                              <td className="px-3 py-2">{rc.grade || '-'}</td>
                              <td className="px-3 py-2">{rc.ca_score ?? rc.caScore ?? '-'}</td>
                              <td className="px-3 py-2">{rc.exam_score ?? rc.examScore ?? '-'}</td>
                              <td className="px-3 py-2">{rc.is_carryover || rc.isCarryover ? 'Yes' : 'No'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CourseRegistrationPage;
