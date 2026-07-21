import { useState, useEffect, useMemo } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { Plus, Trash2, Loader2, UserCheck, Users, BookOpen, Archive } from 'lucide-react';
import { getCourses, createCourse, deleteCourse, updateCourse } from '../../api/courses';
import { getUsers } from '../../api/users';
import type { User as UserType } from '../../types';

const CourseManagementPage = () => {
  const { success, error: notifyError } = useNotification();
  const [courses, setCourses] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('');
  const [view, setView] = useState<'courses' | 'assignments'>('courses');

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState('3');
  const [level, setLevel] = useState('500');
  const [semester, setSemester] = useState('harmattan');
  const [courseType, setCourseType] = useState('departmental');
  const [submitting, setSubmitting] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [coursesResult, lecturersResult] = await Promise.all([
        getCourses({ page: 1, perPage: 100 }),
        getUsers({ page: 1, perPage: 100, role: 'lecturer' }),
      ]);
      setCourses(coursesResult.items || (coursesResult as unknown as any[]));
      setLecturers(Array.isArray(lecturersResult) ? lecturersResult : []);
    } catch (err: any) {
      notifyError('Load Failed', err?.response?.data?.message || 'Could not load data');
    } finally {
      setLoading(false);
    }
  };

  const lecturerMap = useMemo(() => {
    const map: Record<string, UserType> = {};
    lecturers.forEach((l) => { map[l.id] = l; });
    return map;
  }, [lecturers]);

  const lecturerCourseMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    courses.forEach((c) => {
      const lid = c.lecturer_id || c.lecturerId;
      if (lid) {
        if (!map[lid]) map[lid] = [];
        map[lid].push(c);
      }
    });
    return map;
  }, [courses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !title) return;
    try {
      setSubmitting(true);
      await createCourse({
        code: code.toUpperCase(),
        title,
        unit: parseInt(units),
        level: parseInt(level),
        semester: semester,
        is_active: true,
        course_type: courseType,
      });
      setCreateOpen(false);
      setCode('');
      setTitle('');
      setUnits('3');
      success('Course Created', `Successfully registered ${code.toUpperCase()}`);
      fetchInitialData();
    } catch (err: any) {
      notifyError('Create Failed', err?.response?.data?.message || 'Could not create course');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string, courseCode: string, isActive: boolean) => {
    const action = isActive ? 'Archive' : 'Restore';
    if (!confirm(`${action} course "${courseCode}"?`)) return;
    try {
      await updateCourse(id, { is_active: !isActive, isActive: !isActive } as any);
      success(`Course ${action}d`, `${action}d ${courseCode} successfully`);
      fetchInitialData();
    } catch (err: any) {
      notifyError(`${action} Failed`, err?.response?.data?.error || err?.response?.data?.message || `Could not ${action.toLowerCase()} course`);
    }
  };

  const handleDelete = async (id: string, courseCode: string) => {
    if (!confirm(`Permanently delete course "${courseCode}"? This cannot be undone.`)) return;
    try {
      await deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      success('Course Deleted', `Permanently deleted ${courseCode}`);
    } catch (err: any) {
      notifyError('Delete Failed', err?.response?.data?.error || err?.response?.data?.message || 'Could not delete course. It may have associated records (registrations, results, etc). Try archiving instead.');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    try {
      setAssigning(true);
      await updateCourse(selectedCourse.id, {
        lecturer_id: selectedLecturerId,
        lecturerId: selectedLecturerId,
      } as any);
      success('Lecturer Assigned', `Assigned lecturer to ${selectedCourse.code}`);
      setAssignOpen(false);
      fetchInitialData();
    } catch (err: any) {
      notifyError('Assignment Failed', err?.response?.data?.message || 'Could not assign lecturer');
    } finally {
      setAssigning(false);
    }
  };

  const getLecturerName = (lecturerId: string) => {
    const lecturer = lecturerMap[lecturerId];
    if (!lecturer) return 'Unassigned';
    return lecturer.fullName || `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim() || lecturer.email;
  };

  const openAssignModal = (course: any) => {
    setSelectedCourse(course);
    setSelectedLecturerId(course.lecturer_id || course.lecturerId || '');
    setAssignOpen(true);
  };

  const courseColumns = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'unit', label: 'Units' },
    { key: 'level', label: 'Level' },
    {
      key: 'courseType',
      label: 'Type',
      render: (val: unknown) => (
        <span className={`text-[10px] px-2 py-1 rounded-full ${val === 'departmental' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400'}`}>
          {val === 'departmental' ? 'Dept' : 'Non-Dept'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: unknown, row: any) => (
        <span className={`text-[10px] px-2 py-1 rounded-full ${row.isActive !== false ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300' : 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400'}`}>
          {row.isActive !== false ? 'Active' : 'Archived'}
        </span>
      ),
    },
    {
      key: 'lecturer',
      label: 'Assigned Lecturer',
      render: (_: unknown, row: any) => {
        const lid = row.lecturer_id || row.lecturerId;
        return (
          <span className={`text-sm font-medium ${lid ? 'text-surface-700 dark:text-surface-300' : 'text-surface-400 italic'}`}>
            {lid ? getLecturerName(lid) : 'Unassigned'}
          </span>
        );
      },
    },
    {
      key: 'action',
      label: 'Actions',
      render: (_: unknown, row: any) => (
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="outline"
            leftIcon={<UserCheck className="w-3.5 h-3.5" />}
            onClick={() => openAssignModal(row)}
          >
            Assign
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="text-warning-600 hover:bg-warning-50 dark:text-warning-400"
            leftIcon={<Archive className="w-3.5 h-3.5" />}
            onClick={() => handleArchive(row.id, row.code, row.isActive !== false)}
          >
            {row.isActive !== false ? 'Archive' : 'Restore'}
          </Button>
          <Button
            size="xs"
            variant="outline"
            className="text-danger-500 hover:bg-danger-50"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => handleDelete(row.id, row.code)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Create, modify and assign lecturers to academic courses.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant={view === 'assignments' ? 'primary' : 'outline'}
            leftIcon={<Users className="w-4 h-4" />}
            onClick={() => setView(view === 'assignments' ? 'courses' : 'assignments')}
          >
            {view === 'assignments' ? 'All Courses' : 'Lecturer Assignments'}
          </Button>
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
            Create Course
          </Button>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-surface-500">Loading data...</span>
          </div>
        ) : view === 'courses' ? (
          <DataTable columns={courseColumns} data={courses} />
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-primary-500" />
              <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                Lecturer Course Assignments ({Object.keys(lecturerCourseMap).length} lecturers with courses)
              </h3>
            </div>
            {Object.keys(lecturerCourseMap).length === 0 ? (
              <p className="text-sm text-surface-500 text-center py-6">No courses assigned to any lecturer yet.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(lecturerCourseMap).map(([lecturerId, assignedCourses]) => {
                  const lecturer = lecturerMap[lecturerId];
                  const name = lecturer
                    ? lecturer.fullName || `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim() || lecturer.email
                    : 'Unknown Lecturer';
                  return (
                    <div key={lecturerId} className="border border-surface-200 dark:border-surface-700 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-surface-900 dark:text-white">{name}</p>
                          <p className="text-xs text-surface-500">{lecturer?.email}</p>
                        </div>
                        <Badge variant="primary" className="ml-auto">{assignedCourses.length} course{assignedCourses.length !== 1 ? 's' : ''}</Badge>
                      </div>
                      <div className="ml-13 space-y-1">
                        {assignedCourses.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4 text-primary-400" />
                              <span className="font-medium">{c.code}</span>
                              <span className="text-surface-500">{c.title}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-surface-500">
                              <span>{c.unit || c.creditUnits} units</span>
                              <span>Level {c.level}</span>
                              <Button size="xs" variant="ghost" onClick={() => { setSelectedCourse(c); setSelectedLecturerId(lecturerId); setAssignOpen(true); }}>
                                Reassign
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {/* Unassigned courses */}
                {courses.filter((c) => !c.lecturer_id && !c.lecturerId).length > 0 && (
                  <div className="border border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-4">
                    <p className="text-sm font-medium text-surface-500 mb-2">
                      Unassigned Courses ({courses.filter((c) => !c.lecturer_id && !c.lecturerId).length})
                    </p>
                    <div className="space-y-1">
                      {courses.filter((c) => !c.lecturer_id && !c.lecturerId).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-surface-400" />
                            <span className="font-medium">{c.code}</span>
                            <span className="text-surface-500">{c.title}</span>
                          </div>
                          <Button size="xs" variant="success" onClick={() => openAssignModal(c)}>Assign Lecturer</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Create Course Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create New Course">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Course Code" placeholder="e.g. CPE 511" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Input label="Course Title" placeholder="e.g. Embedded Systems Design" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Credit Units" type="number" value={units} onChange={(e) => setUnits(e.target.value)} required />
            <Input label="Level" type="number" value={level} onChange={(e) => setLevel(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Semester</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="harmattan">Harmattan</option>
              <option value="rain">Rain</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Course Type</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              value={courseType}
              onChange={(e) => setCourseType(e.target.value)}
            >
              <option value="departmental">Departmental</option>
              <option value="non_departmental">Non-Departmental</option>
            </select>
          </div>
          <Button type="submit" className="w-full" isLoading={submitting}>
            Save Course
          </Button>
        </form>
      </Modal>

      {/* Assign Lecturer Modal */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title={`Assign Lecturer to ${selectedCourse?.code || ''}`}>
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Select Lecturer</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
              value={selectedLecturerId}
              onChange={(e) => setSelectedLecturerId(e.target.value)}
            >
              <option value="">Unassigned / Remove Lecturer</option>
              {lecturers.map((lecturer) => {
                const name = lecturer.fullName || `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim() || lecturer.email;
                const assignedCount = (lecturerCourseMap[lecturer.id] || []).length;
                return (
                  <option key={lecturer.id} value={lecturer.id}>
                    {name} ({lecturer.email}) {assignedCount > 0 ? `- ${assignedCount} course${assignedCount !== 1 ? 's' : ''}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedLecturerId && lecturerCourseMap[selectedLecturerId] && (
            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
              <p className="text-xs font-medium text-surface-500 mb-1">Currently assigned courses for this lecturer:</p>
              <div className="flex flex-wrap gap-1.5">
                {lecturerCourseMap[selectedLecturerId].map((c: any) => (
                  <Badge key={c.id} variant={c.id === selectedCourse?.id ? 'warning' : 'primary'}>{c.code}</Badge>
                ))}
              </div>
            </div>
          )}
          <Button type="submit" className="w-full" isLoading={assigning}>
            {selectedLecturerId ? 'Assign Lecturer' : 'Remove Lecturer'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default CourseManagementPage;
