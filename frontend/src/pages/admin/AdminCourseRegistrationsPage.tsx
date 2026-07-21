import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { getUsers } from '../../api/users';
import { getCourses } from '../../api/courses';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import {
  getStudentRegistrations,
  getRegisteredCourses,
  createRegistration,
  addCourseToRegistration,
  removeCourseFromRegistration,
  updateRegistrationStatus,
} from '../../api/course-registrations';
import { useNotification } from '../../hooks/useNotification';
import { BookOpen, User, Plus, Trash2, CheckCircle, XCircle, Loader2, Search } from 'lucide-react';
import type { User as UserType, Course, AcademicSession, SemesterEntry } from '../../types';

const AdminCourseRegistrationsPage = () => {
  const { success, error: notifyError } = useNotification();

  const [students, setStudents] = useState<UserType[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [semesters, setSemesters] = useState<SemesterEntry[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [activeRegistration, setActiveRegistration] = useState<any>(null);
  const [registeredCoursesMap, setRegisteredCoursesMap] = useState<Record<string, any[]>>({});

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Modal states
  const [isNewRegModalOpen, setIsNewRegModalOpen] = useState(false);
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);

  // New Reg Form
  const [newRegSessionId, setNewRegSessionId] = useState('');
  const [newRegSemesterId, setNewRegSemesterId] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  // Add Course Form
  const [selectedCourseIdToAdd, setSelectedCourseIdToAdd] = useState('');
  const [submittingAddCourse, setSubmittingAddCourse] = useState(false);

  // Load students, sessions, all courses
  useEffect(() => {
    setLoadingStudents(true);
    getUsers({ role: 'student', page_size: 100 })
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        setStudents(list);
      })
      .catch(() => notifyError('Error', 'Failed to load students list'))
      .finally(() => setLoadingStudents(false));

    getSessions({ page_id: 1, page_size: 20 })
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        setSessions(list);
        if (list.length > 0) setNewRegSessionId(list[0].id);
      })
      .catch(() => {});

    getCourses()
      .then((res) => setAllCourses(res || []))
      .catch(() => {});
  }, []);

  // Fetch semesters when session changes
  useEffect(() => {
    if (!newRegSessionId) return;
    listSessionSemesters(newRegSessionId)
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        setSemesters(list);
        if (list.length > 0) setNewRegSemesterId(list[0].id);
      })
      .catch(() => setSemesters([]));
  }, [newRegSessionId]);

  // Load registrations when selected student changes
  useEffect(() => {
    if (!selectedStudentId) {
      setRegistrations([]);
      setActiveRegistration(null);
      return;
    }
    loadStudentRegistrations(selectedStudentId);
  }, [selectedStudentId]);

  const loadStudentRegistrations = async (studentId: string) => {
    setLoadingRegistrations(true);
    try {
      const regs = await getStudentRegistrations(studentId);
      setRegistrations(regs);
      if (regs.length > 0) {
        setActiveRegistration(regs[0]);
        loadRegistrationCourses(regs[0].id);
      } else {
        setActiveRegistration(null);
      }
    } catch {
      notifyError('Error', 'Failed to load registrations for selected student');
      setRegistrations([]);
    } finally {
      setLoadingRegistrations(false);
    }
  };

  const loadRegistrationCourses = async (regId: string) => {
    setLoadingCourses(true);
    try {
      const courses = await getRegisteredCourses(regId);
      setRegisteredCoursesMap((prev) => ({ ...prev, [regId]: courses }));
    } catch {
      notifyError('Error', 'Failed to load registered courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleCreateRegistration = async () => {
    if (!selectedStudentId || !newRegSessionId || !newRegSemesterId) {
      notifyError('Error', 'Please select student, session, and semester');
      return;
    }
    setSubmittingReg(true);
    try {
      await createRegistration({
        student_id: selectedStudentId,
        session_id: newRegSessionId,
        semester_id: newRegSemesterId,
        status: 'approved',
      });
      success('Success', 'Course registration header created');
      setIsNewRegModalOpen(false);
      loadStudentRegistrations(selectedStudentId);
    } catch (err: any) {
      notifyError('Registration Error', err?.message || 'Failed to create course registration header');
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleAddCourse = async () => {
    if (!activeRegistration || !selectedCourseIdToAdd) {
      notifyError('Error', 'Please select a course to add');
      return;
    }
    setSubmittingAddCourse(true);
    try {
      await addCourseToRegistration(activeRegistration.id, {
        course_id: selectedCourseIdToAdd,
        status: 'enrolled',
      });
      success('Success', 'Course added to student registration');
      setIsAddCourseModalOpen(false);
      setSelectedCourseIdToAdd('');
      loadRegistrationCourses(activeRegistration.id);
    } catch (err: any) {
      notifyError('Error', err?.message || 'Failed to add course to registration');
    } finally {
      setSubmittingAddCourse(false);
    }
  };

  const handleRemoveCourse = async (registeredCourseId: string) => {
    if (!activeRegistration) return;
    if (!confirm('Are you sure you want to remove this course from student registration?')) return;
    try {
      await removeCourseFromRegistration(activeRegistration.id, registeredCourseId);
      success('Success', 'Course removed');
      loadRegistrationCourses(activeRegistration.id);
    } catch (err: any) {
      notifyError('Error', err?.message || 'Failed to remove course');
    }
  };

  const handleStatusChange = async (regId: string, newStatus: string) => {
    try {
      await updateRegistrationStatus(regId, newStatus);
      success('Success', `Registration status updated to ${newStatus}`);
      loadStudentRegistrations(selectedStudentId);
    } catch (err: any) {
      notifyError('Error', err?.message || 'Failed to update registration status');
    }
  };

  const filteredStudents = students.filter((s) => {
    const name = (s.fullName || `${s.firstName || ''} ${s.lastName || ''}`).toLowerCase();
    const email = (s.email || '').toLowerCase();
    const q = studentSearch.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const selectedStudentObj = students.find((s) => s.id === selectedStudentId);
  const activeRegCourses = activeRegistration ? registeredCoursesMap[activeRegistration.id] || [] : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Course Registrations</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          View, register, and manage course registrations for students in the department
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Student Selector Sidebar */}
        <Card className="p-4 space-y-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary-500" /> Select Student
          </CardTitle>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
            />
          </div>

          {loadingStudents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <p className="text-xs text-surface-400 text-center py-4">No students found.</p>
          ) : (
            <div className="space-y-1 max-h-[450px] overflow-y-auto pr-1">
              {filteredStudents.map((s) => {
                const name = s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
                const isSelected = s.id === selectedStudentId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-sm transition-all ${
                      isSelected
                        ? 'bg-primary-500 text-white font-medium shadow-sm'
                        : 'hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300'
                    }`}
                  >
                    <p className="truncate font-semibold">{name}</p>
                    <p className={`text-xs truncate ${isSelected ? 'text-primary-100' : 'text-surface-400'}`}>
                      {s.email}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Registration Details Main Area */}
        <div className="md:col-span-2 space-y-6">
          {!selectedStudentId ? (
            <Card className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
              <h3 className="font-bold text-lg text-surface-700 dark:text-surface-200">No Student Selected</h3>
              <p className="text-sm text-surface-400">Select a student from the sidebar to view or manage their course registrations.</p>
            </Card>
          ) : (
            <>
              {/* Selected Student Banner */}
              <Card glass className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg text-surface-900 dark:text-surface-100">
                    {selectedStudentObj?.fullName || selectedStudentObj?.email}
                  </h3>
                  <p className="text-xs text-surface-400">Student ID: {selectedStudentId}</p>
                </div>
                <Button
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsNewRegModalOpen(true)}
                >
                  Create New Registration
                </Button>
              </Card>

              {/* Registrations Tab / Switcher */}
              {loadingRegistrations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <span className="ml-2 text-sm text-surface-500">Loading registrations...</span>
                </div>
              ) : registrations.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-sm text-surface-500 mb-4">This student has no course registrations on record.</p>
                  <Button size="sm" onClick={() => setIsNewRegModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                    Register Courses Now
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Select active registration tab */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {registrations.map((reg, idx) => {
                      const isActive = activeRegistration?.id === reg.id;
                      return (
                        <button
                          key={reg.id}
                          onClick={() => {
                            setActiveRegistration(reg);
                            loadRegistrationCourses(reg.id);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                            isActive
                              ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 text-primary-600 dark:text-primary-400'
                              : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400'
                          }`}
                        >
                          Registration #{idx + 1} ({reg.status})
                        </button>
                      );
                    })}
                  </div>

                  {activeRegistration && (
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            Registration Details
                            <Badge
                              variant={
                                activeRegistration.status === 'approved'
                                  ? 'success'
                                  : activeRegistration.status === 'submitted'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            >
                              {activeRegistration.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Total Units: {activeRegistration.total_units || activeRegistration.totalUnits || 0}
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeRegistration.status !== 'approved' && (
                            <Button
                              size="xs"
                              variant="success"
                              leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                              onClick={() => handleStatusChange(activeRegistration.id, 'approved')}
                            >
                              Approve
                            </Button>
                          )}
                          {activeRegistration.status !== 'rejected' && (
                            <Button
                              size="xs"
                              variant="danger"
                              leftIcon={<XCircle className="w-3.5 h-3.5" />}
                              onClick={() => handleStatusChange(activeRegistration.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="outline"
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                            onClick={() => setIsAddCourseModalOpen(true)}
                          >
                            Add Course
                          </Button>
                        </div>
                      </CardHeader>

                      <div className="p-4 pt-0">
                        {loadingCourses ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                            <span className="ml-2 text-xs text-surface-400">Loading courses...</span>
                          </div>
                        ) : activeRegCourses.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-surface-200 dark:border-surface-700 rounded-lg">
                            <p className="text-xs text-surface-400 mb-2">No individual courses added to this registration yet.</p>
                            <Button size="xs" variant="outline" onClick={() => setIsAddCourseModalOpen(true)}>
                              Add Course Now
                            </Button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 border-b border-surface-200 dark:border-surface-700">
                                  <th className="px-3 py-2">Course Code</th>
                                  <th className="px-3 py-2">Course Title</th>
                                  <th className="px-3 py-2">Units</th>
                                  <th className="px-3 py-2">Status</th>
                                  <th className="px-3 py-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                                {activeRegCourses.map((rc: any) => {
                                  const matchedCourse = allCourses.find((c) => c.id === rc.course_id);
                                  return (
                                    <tr key={rc.id}>
                                      <td className="px-3 py-2 font-semibold">
                                        {matchedCourse?.code || rc.course_id.slice(0, 8)}
                                      </td>
                                      <td className="px-3 py-2">
                                        {matchedCourse?.title || 'Unknown Course'}
                                      </td>
                                      <td className="px-3 py-2">{matchedCourse?.unit ?? '-'}</td>
                                      <td className="px-3 py-2">
                                        <Badge variant={rc.status === 'enrolled' ? 'info' : 'neutral'}>
                                          {rc.status}
                                        </Badge>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <button
                                          onClick={() => handleRemoveCourse(rc.id)}
                                          className="p-1 text-danger-500 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-950/40 rounded transition-all"
                                          title="Remove course"
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
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Registration Header Modal */}
      <Modal
        isOpen={isNewRegModalOpen}
        onClose={() => setIsNewRegModalOpen(false)}
        title="Create Student Course Registration Header"
      >
        <div className="space-y-4">
          <p className="text-xs text-surface-400">
            Create an official registration session/semester record for student: <span className="font-semibold text-surface-700 dark:text-surface-200">{selectedStudentObj?.fullName || selectedStudentObj?.email}</span>
          </p>

          <Select
            label="Academic Session"
            value={newRegSessionId}
            onChange={(e) => setNewRegSessionId(e.target.value)}
            options={sessions.map((s) => ({ value: s.id, label: s.name }))}
          />

          <Select
            label="Semester"
            value={newRegSemesterId}
            onChange={(e) => setNewRegSemesterId(e.target.value)}
            options={semesters.map((sem) => ({ value: sem.id, label: sem.name }))}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsNewRegModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" isLoading={submittingReg} onClick={handleCreateRegistration}>
              Create Registration
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Course Modal */}
      <Modal
        isOpen={isAddCourseModalOpen}
        onClose={() => setIsAddCourseModalOpen(false)}
        title="Add Course to Registration"
      >
        <div className="space-y-4">
          <Select
            label="Select Course"
            value={selectedCourseIdToAdd}
            onChange={(e) => setSelectedCourseIdToAdd(e.target.value)}
            options={[
              { value: '', label: '-- Choose a course --' },
              ...allCourses.map((c) => ({
                value: c.id,
                label: `${c.code} - ${c.title} (${c.unit} units)`,
              })),
            ]}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsAddCourseModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" isLoading={submittingAddCourse} onClick={handleAddCourse}>
              Add Course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminCourseRegistrationsPage;
