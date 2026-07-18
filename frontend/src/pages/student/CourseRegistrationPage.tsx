import { useState, useEffect, useCallback } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getCoursesByLevelAndSemester } from '../../api/courses';
import { submitRegistration, getActiveSessionAndSemester } from '../../api/course-registrations';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { Check, Plus, AlertCircle, Save, BookOpen, RefreshCw } from 'lucide-react';
import type { Course } from '../../types';

const CourseRegistrationPage = () => {
  const { success, warning, error: notifyError } = useNotification();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [semesterInfo, setSemesterInfo] = useState<{ session: any; semester: any }>({ session: null, semester: null });
  const [loadError, setLoadError] = useState(false);

  const studentLevel = (user as any)?.level || 100;

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

      const semName = semResult.semester.name || semResult.semester.season || 'harmattan';
      const courseList = await getCoursesByLevelAndSemester(studentLevel, semName);
      setCourses(courseList);
    } catch {
      setLoadError(true);
      notifyError('Error', 'Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [studentLevel, notifyError]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const toggleCourse = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedCourses = courses.filter((c) => selectedIds.includes(c.id));
  const totalUnits = selectedCourses.reduce((sum, c) => sum + c.unit, 0);
  const minUnits = 12;
  const maxUnits = 24;
  const canSubmit = totalUnits >= minUnits && totalUnits <= maxUnits && selectedCourses.length > 0 && !submitting;

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

    setSubmitting(true);
    try {
      await submitRegistration({
        session_id: semesterInfo.session.id,
        semester_id: semesterInfo.semester.id,
        course_ids: selectedIds,
      });
      success(
        'Registration Submitted',
        `Successfully registered ${selectedCourses.length} courses (${totalUnits} units) for the semester.`
      );
      setSelectedIds([]);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to submit registration.';
      notifyError('Registration Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Registration</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {semesterInfo.semester
              ? `${semesterInfo.semester.name || semesterInfo.semester.season || 'Current'} Semester — Level ${studentLevel}`
              : 'Select and register your academic courses for the current semester.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadCourses} leftIcon={<RefreshCw className="w-4 h-4" />}>
          Refresh
        </Button>
      </div>

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
                  : `${courses.length} courses available for Level ${studentLevel}`}
              </CardDescription>
            </CardHeader>
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
                  <span className="ml-2 text-sm text-surface-500">Loading courses...</span>
                </div>
              )}
              {!loading && courses.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-surface-900 dark:text-white">{c.code}</span>
                        <Badge variant={c.courseType === 'core' ? 'primary' : c.courseType === 'elective' ? 'success' : 'outline'}>
                          {c.courseType || c.subcategory || 'core'}
                        </Badge>
                        {c.prerequisiteId && (
                          <Badge variant="warning" className="text-[10px]">Prereq</Badge>
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
                        leftIcon={isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      >
                        {isSelected ? 'Selected' : 'Add'}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {!loading && !loadError && courses.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                  <p className="text-sm text-surface-500">No courses available for registration.</p>
                  <p className="text-xs text-surface-400 mt-1">Courses may not be set up for your level yet.</p>
                </div>
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
                <span className={`font-semibold ${totalUnits < minUnits ? 'text-warning-500' : totalUnits > maxUnits ? 'text-danger-500' : 'text-primary-500'}`}>
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
                  <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-surface-100 dark:border-surface-800 last:border-0">
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
    </div>
  );
};

export default CourseRegistrationPage;
