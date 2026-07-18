import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getCourse } from '../../api/courses';
import { getUser } from '../../api/users';
import { useNotification } from '../../hooks/useNotification';
import { ArrowLeft, BookOpen, User as UserIcon, Layers, Clock, Loader2 } from 'lucide-react';

const CourseDetailPage = () => {
  const { id } = useParams();
  const { error: notifyError } = useNotification();
  const [course, setCourse] = useState<any>(null);
  const [lecturerName, setLecturerName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCourse(id)
      .then((c) => {
        setCourse(c);
        const lid = c.lecturerId || c.lecturerId;
        if (lid) {
          getUser(lid)
            .then((u) => setLecturerName(u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email))
            .catch(() => setLecturerName('Unknown'));
        }
      })
      .catch(() => notifyError('Error', 'Failed to load course details'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="ml-2 text-sm text-surface-500">Loading course details...</span>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="space-y-6 max-w-xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold">Course Not Found</h2>
        <p className="text-surface-500">The course record you are looking for does not exist.</p>
        <Link to="/admin/courses">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Courses
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link to="/admin/courses">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Course Management
        </Button>
      </Link>

      <Card glass className="p-8">
        <CardHeader className="border-b border-surface-200 dark:border-surface-700/50 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-success-500 to-primary-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="primary">{course.code}</Badge>
                <Badge variant={course.isActive ? 'success' : 'danger'}>
                  {course.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold">{course.title}</CardTitle>
              <CardDescription>Course ID: {course.id}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Layers className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Credit Units</p>
                <p className="font-semibold">{course.unit || course.creditUnits || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Layers className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Level</p>
                <p>{course.level ? `${course.level} Level` : 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Clock className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Semester</p>
                <p className="capitalize">{course.semester || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <UserIcon className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Assigned Lecturer</p>
                <p className={`font-medium ${(course.lecturer_id || course.lecturerId) ? 'text-surface-900 dark:text-white' : 'text-surface-400 italic'}`}>
                  {(course.lecturer_id || course.lecturerId) ? lecturerName || 'Loading...' : 'No lecturer assigned'}
                </p>
              </div>
            </div>

            {course.courseType && (
              <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
                <BookOpen className="w-5 h-5 text-primary-500" />
                <div>
                  <p className="text-xs text-surface-400 font-medium">Course Type</p>
                  <p className="capitalize">{course.courseType}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CourseDetailPage;
