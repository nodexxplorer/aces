import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { useNotification } from '../../hooks/useNotification';
import { Search, Loader2, Users, BookOpen, Calendar, X, ChevronRight, Trash2, Check, Ban } from 'lucide-react';
import { listLecturers, getLecturerProfile, assignCourseToLecturer, listLecturerAssignments, removeCourseAssignment, listAllLeaveRequests, updateLeaveStatus } from '../../api/lecturers';
import { getCourses } from '../../api/courses';
import type { LecturerProfile, LecturerAssignment, LecturerLeave } from '../../api/lecturers';
import type { Course } from '../../types';

type Tab = 'list' | 'courses' | 'leave';

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'inactive' || s === 'terminated') return 'danger' as const;
  if (s === 'on_leave') return 'warning' as const;
  return 'default' as const;
};

const leaveVariant = (s: string) => {
  if (s === 'approved') return 'success' as const;
  if (s === 'rejected') return 'danger' as const;
  if (s === 'pending') return 'warning' as const;
  return 'default' as const;
};

const LecturerManagementPage = () => {
  const { success, error: notifyError } = useNotification();

  const [selectedTab, setSelectedTab] = useState<Tab>('list');
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LecturerLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedLecturer, setSelectedLecturer] = useState<LecturerProfile | null>(null);
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [l, c, lr] = await Promise.allSettled([
        listLecturers(),
        getCourses(),
        listAllLeaveRequests(),
      ]);
      if (l.status === 'fulfilled') setLecturers(Array.isArray(l.value) ? l.value : []);
      if (c.status === 'fulfilled') setCourses(Array.isArray(c.value) ? c.value : []);
      if (lr.status === 'fulfilled') setLeaveRequests(Array.isArray(lr.value) ? lr.value : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const filteredLecturers = lecturers.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.full_name || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.staff_id || '').toLowerCase().includes(q) ||
      (l.department || '').toLowerCase().includes(q)
    );
  });

  const assignedCourseIds = new Set(courses.filter((c) => c.lecturerId).map((c) => c.id));

  const unassignedCourses = courses.filter((c) => !c.lecturerId && c.isActive);

  const handleSelectLecturer = async (lecturer: LecturerProfile) => {
    setSelectedLecturer(lecturer);
    setAssignmentsLoading(true);
    setAssignModalOpen(true);
    try {
      const data = await getLecturerProfile(lecturer.id);
      setAssignments(data.assignments || []);
    } catch {
      try {
        const assignmentsData = await listLecturerAssignments(lecturer.id);
        setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      } catch {
        setAssignments([]);
      }
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const handleAssignCourse = async () => {
    if (!selectedLecturer || !assignCourseId) return;
    try {
      setAssigning(true);
      await assignCourseToLecturer(selectedLecturer.id, assignCourseId);
      success('Course Assigned', 'Course has been assigned to the lecturer');
      setAssignCourseId('');
      setAssignModalOpen(false);
      const updated = await getLecturerProfile(selectedLecturer.id);
      setAssignments(updated.assignments || []);
      fetchAll();
    } catch (err: any) {
      notifyError('Assign Failed', err?.response?.data?.message || 'Could not assign course');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignment: LecturerAssignment) => {
    try {
      await removeCourseAssignment(assignment.id);
      success('Removed', 'Course assignment has been removed');
      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      fetchAll();
    } catch (err: any) {
      notifyError('Remove Failed', err?.response?.data?.message || 'Could not remove assignment');
    }
  };

  const handleLeaveAction = async (leave: LecturerLeave, status: 'approved' | 'rejected') => {
    try {
      await updateLeaveStatus(leave.id, status);
      success('Updated', `Leave request ${status}`);
      setLeaveRequests((prev) => prev.map((l) => l.id === leave.id ? { ...l, status } : l));
    } catch (err: any) {
      notifyError('Update Failed', err?.response?.data?.message || 'Could not update leave status');
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'list', label: 'Lecturers', icon: <Users className="w-4 h-4" /> },
    { key: 'courses', label: 'Assign Courses', icon: <BookOpen className="w-4 h-4" /> },
    { key: 'leave', label: 'Leave Requests', icon: <Calendar className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Lecturer Management</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage lecturer profiles, course assignments, and leave requests.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelectedTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              selectedTab === t.key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {selectedTab === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-500" />
              All Lecturers
            </CardTitle>
            <CardDescription>{filteredLecturers.length} lecturer{filteredLecturers.length !== 1 && 's'}</CardDescription>
          </CardHeader>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name, email, staff ID or department..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading lecturers...</span>
            </div>
          ) : filteredLecturers.length === 0 ? (
            <p className="text-center text-sm text-surface-500 py-8">No lecturers found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50">
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Lecturer</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Staff ID</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Rank</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Specialization</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                  {filteredLecturers.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-surface-50 dark:hover:bg-surface-900/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedLecturer(l)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {l.avatar_url ? (
                            <img src={l.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-semibold text-primary-600 dark:text-primary-400">
                              {(l.full_name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-surface-900 dark:text-surface-100">{l.full_name}</p>
                            <p className="text-xs text-surface-500">{l.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{l.staff_id || '—'}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{l.department || '—'}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{l.rank || '—'}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{l.specialization || '—'}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400 capitalize">{l.employment_type || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(l.employment_status || 'active')} dot>
                          {(l.employment_status || 'active').replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {selectedTab === 'courses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Lecturers</CardTitle>
                <CardDescription>{filteredLecturers.length} total</CardDescription>
              </CardHeader>
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                </div>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {filteredLecturers.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => handleSelectLecturer(l)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-surface-50 dark:hover:bg-surface-900/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-semibold text-primary-600 dark:text-primary-400 shrink-0">
                        {(l.full_name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{l.full_name}</p>
                        <p className="text-xs text-surface-500 truncate">{l.department || 'No department'}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary-500" />
                  {selectedLecturer ? `${selectedLecturer.full_name} — Assignments` : 'Course Assignments'}
                </CardTitle>
                {selectedLecturer && (
                  <Button size="sm" onClick={() => setAssignModalOpen(true)} leftIcon={<BookOpen className="w-3.5 h-3.5" />}>
                    Assign Course
                  </Button>
                )}
              </CardHeader>
              {!selectedLecturer ? (
                <p className="text-center text-sm text-surface-500 py-12">
                  Select a lecturer from the left panel to view their course assignments.
                </p>
              ) : assignmentsLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <span className="ml-2 text-sm text-surface-500">Loading assignments...</span>
                </div>
              ) : assignments.length === 0 ? (
                <p className="text-center text-sm text-surface-500 py-12">
                  No courses assigned to this lecturer yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-900/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                            {a.course_code} — {a.course_title}
                          </p>
                          <p className="text-xs text-surface-500">
                            {a.course_unit} unit{a.course_unit !== 1 && 's'} · Level {a.level} · {a.semester}
                            {a.is_primary && ' · Primary'}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant="ghost"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={() => handleRemoveAssignment(a)}
                        className="text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-500/10"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {selectedTab === 'leave' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-500" />
              Leave Requests
            </CardTitle>
            <CardDescription>{leaveRequests.length} request{leaveRequests.length !== 1 && 's'}</CardDescription>
          </CardHeader>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading leave requests...</span>
            </div>
          ) : leaveRequests.length === 0 ? (
            <p className="text-center text-sm text-surface-500 py-8">No leave requests found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-900/50">
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Lecturer</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Period</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Reason</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-surface-600 dark:text-surface-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                  {leaveRequests.map((lr) => (
                    <tr key={lr.id} className="hover:bg-surface-50 dark:hover:bg-surface-900/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-surface-900 dark:text-surface-100">{lr.lecturer_name || 'Unknown'}</p>
                      </td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400 capitalize">{lr.leave_type}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400 text-xs">
                        {new Date(lr.start_date).toLocaleDateString()} — {new Date(lr.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400 max-w-[200px] truncate">{lr.reason}</td>
                      <td className="px-4 py-3">
                        <Badge variant={leaveVariant(lr.status)} dot>
                          {lr.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {lr.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button
                              size="xs"
                              variant="success"
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                              onClick={() => handleLeaveAction(lr, 'approved')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              leftIcon={<Ban className="w-3.5 h-3.5" />}
                              onClick={() => handleLeaveAction(lr, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-surface-400">
                            {lr.approved_at ? new Date(lr.approved_at).toLocaleDateString() : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        isOpen={assignModalOpen}
        onClose={() => { setAssignModalOpen(false); setAssignCourseId(''); }}
        title={`Assign Course — ${selectedLecturer?.full_name || ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-500">
            Select an unassigned course to assign to this lecturer.
          </p>
          <Select
            label="Course"
            value={assignCourseId}
            onChange={(e) => setAssignCourseId(e.target.value)}
            placeholder="Select a course..."
            options={unassignedCourses.map((c) => ({
              value: c.id,
              label: `${c.code} — ${c.title} (${c.unit} unit${c.unit !== 1 ? 's' : ''})`,
            }))}
          />
          {unassignedCourses.length === 0 && (
            <p className="text-xs text-surface-400">No unassigned active courses available.</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => { setAssignModalOpen(false); setAssignCourseId(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignCourse}
              isLoading={assigning}
              disabled={!assignCourseId}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedLecturer && !assignModalOpen}
        onClose={() => { setSelectedLecturer(null); setProfileModalOpen(false); }}
        title={selectedLecturer?.full_name || 'Lecturer Profile'}
        size="lg"
      >
        {selectedLecturer && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              {selectedLecturer.avatar_url ? (
                <img src={selectedLecturer.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xl font-bold text-primary-600 dark:text-primary-400">
                  {(selectedLecturer.full_name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-white">{selectedLecturer.full_name}</h3>
                <p className="text-sm text-surface-500">{selectedLecturer.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                ['Staff ID', selectedLecturer.staff_id],
                ['Department', selectedLecturer.department],
                ['Title', selectedLecturer.title],
                ['Rank', selectedLecturer.rank],
                ['Specialization', selectedLecturer.specialization],
                ['Employment Type', selectedLecturer.employment_type],
                ['Office Location', selectedLecturer.office_location],
                ['Phone', selectedLecturer.phone],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100 capitalize">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-surface-500 dark:text-surface-400">Status</p>
                <Badge variant={statusVariant(selectedLecturer.employment_status || 'active')} dot>
                  {(selectedLecturer.employment_status || 'active').replace('_', ' ')}
                </Badge>
              </div>
            </div>

            {selectedLecturer.bio && (
              <div>
                <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Bio</p>
                <p className="text-sm text-surface-700 dark:text-surface-300">{selectedLecturer.bio}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => { setSelectedLecturer(null); setProfileModalOpen(false); }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LecturerManagementPage;
