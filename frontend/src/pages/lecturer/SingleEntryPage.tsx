import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errors';
import { Search, Loader2, Send, X } from 'lucide-react';
import { listLecturerAssignments, type LecturerAssignment } from '../../api/lecturers';
import { searchStudentsForRoles } from '../../api/role-management';
import { getCourseClassList } from '../../api/courses';
import { enterScore } from '../../api/results';
import type { StudentForRoleManagement } from '../../types';

interface ClassListItem {
  student_id?: string;
  matric_number: string;
  name: string;
  course_code: string;
  status: string;
}

export default function LecturerSingleEntryPage() {
  const { user } = useAuth();
  const { success, error: notifyError, warning } = useNotification();
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [students, setStudents] = useState<StudentForRoleManagement[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentForRoleManagement | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [caScore, setCaScore] = useState('');
  const [examScore, setExamScore] = useState('');
  const [, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingMeta(true);
    Promise.all([
      listLecturerAssignments(user.id).catch(() => []),
      searchStudentsForRoles({ per_page: 500 }).catch(() => ({ data: [] })),
    ])
      .then(([ass, stu]) => {
        const arr = Array.isArray(ass) ? ass : [];
        setAssignments(arr);
        if (arr.length > 0) setSelectedAssignmentId(arr[0].id);
        setStudents(Array.isArray(stu.data) ? stu.data : []);
      })
      .catch(() => notifyError('Error', 'Failed to load initial data'))
      .finally(() => setLoadingMeta(false));
  }, [user?.id]);

  const selAssignment = assignments.find((a) => a.id === selectedAssignmentId);

  useEffect(() => {
    if (!selAssignment?.course_id) return;
    getCourseClassList(selAssignment.course_id)
      .then((classList) => {
        if (!Array.isArray(classList)) return;
        const mapped: StudentForRoleManagement[] = classList
          .filter((item: ClassListItem) => item.matric_number && item.matric_number !== '—')
          .map((item: ClassListItem) => ({
            id: item.student_id || '',
            student_id: item.student_id || '',
            full_name: item.name,
            matric_number: item.matric_number,
            email: '',
            avatar_url: null,
            level: null,
            roles: [],
          }));

        setStudents((prev) => {
          const existingMatrics = new Set(mapped.map((s) => s.matric_number));
          const remain = prev.filter((s) => !existingMatrics.has(s.matric_number));
          return [...mapped, ...remain];
        });
      })
      .catch(() => {});
  }, [selAssignment?.course_id]);

  const filteredStudents = students.filter((s) => {
    const q = studentSearch.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) || (s.matric_number || '').toLowerCase().includes(q);
  });

  const ca = parseFloat(caScore || '0');
  const exam = parseFloat(examScore || '0');

  const handleSubmit = async () => {
    if (!selectedStudent) {
      warning('Missing Info', 'Select a student');
      return;
    }
    if (!selAssignment) {
      warning('Missing Info', 'Select an assigned course');
      return;
    }
    if (isNaN(ca) || ca < 0 || ca > 30) {
      warning('Invalid Score', 'CA score must be 0–30');
      return;
    }
    if (isNaN(exam) || exam < 0 || exam > 70) {
      warning('Invalid Score', 'Exam score must be 0–70');
      return;
    }
    if (ca + exam > 100) {
      warning('Invalid Score', 'Total score cannot exceed 100');
      return;
    }

    setSubmitting(true);
    try {
      await enterScore({
        studentId: selectedStudent.student_id || selectedStudent.id,
        courseId: selAssignment.course_id,
        sessionId: selAssignment.session_id,
        semesterId:
          (selAssignment as unknown as { semester_id?: string; semesterId?: string }).semester_id ||
          (selAssignment as unknown as { semester_id?: string; semesterId?: string }).semesterId ||
          '',
        caScore: ca,
        examScore: exam,
        matricNumber: selectedStudent.matric_number || '',
      });
      success('Submitted', `Result saved for ${selectedStudent.full_name || selectedStudent.matric_number}`);
      setCaScore('');
      setExamScore('');
      setSelectedStudent(null);
      setStudentSearch('');
    } catch (err: unknown) {
      notifyError('Error', getErrorMessage(err, 'Failed to submit score'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Single Entry Grade Upload</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Submit individual Continuous Assessment and Examination scores for enrolled students.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Single Grade Submission</CardTitle>
          <CardDescription>Select your assigned module and student to enter grades</CardDescription>
        </CardHeader>
        <div className="p-6 pt-0 space-y-4">
          <Select
            label="Assigned Module Course Code"
            options={assignments.map((a) => ({
              value: a.id,
              label: `${a.course_code} — ${a.course_title}${a.semester ? ` (${a.semester.toUpperCase()})` : ''}`,
            }))}
            value={selectedAssignmentId}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            placeholder="Select assigned course"
          />

          <div className="relative">
            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              Select Student (by Matric Number or Name)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                placeholder={
                  selectedStudent
                    ? `${selectedStudent.matric_number} (${selectedStudent.full_name})`
                    : 'Search student...'
                }
                value={studentSearch}
                onFocus={() => setShowStudentDropdown(true)}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setSelectedStudent(null);
                  setShowStudentDropdown(true);
                }}
                className="w-full pl-10 pr-10 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              {selectedStudent && (
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentSearch('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showStudentDropdown && !selectedStudent && filteredStudents.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors border-b border-surface-100 dark:border-surface-700 last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedStudent(s);
                      setStudentSearch('');
                      setShowStudentDropdown(false);
                    }}
                  >
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{s.matric_number}</p>
                    <p className="text-xs text-surface-500">{s.full_name || s.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                CA Score (0–30)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={caScore}
                onChange={(e) => setCaScore(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                Exam Score (0–70)
              </label>
              <input
                type="number"
                min={0}
                max={70}
                step={0.5}
                value={examScore}
                onChange={(e) => setExamScore(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Total</label>
              <div className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg font-mono font-semibold text-surface-900 dark:text-white">
                {ca + exam || '—'}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="success"
              leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              onClick={handleSubmit}
              disabled={submitting || !selectedStudent || !selAssignment}
              isLoading={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Grade'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
