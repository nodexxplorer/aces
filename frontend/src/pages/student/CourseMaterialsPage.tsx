import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getCourses } from '../../api/courses';
import { getMyRegisteredCourseIDs } from '../../api/course-registrations';
import {
  listCourseMaterialsByCourse,
  getCourseMaterialDownloadUrl,
  type CourseMaterial,
  type CourseMaterialType,
} from '../../api/course-materials';
import { FileText, Download, Loader2, BookOpen } from 'lucide-react';
import type { Course } from '../../types';

const TYPE_LABELS: Record<CourseMaterialType, string> = {
  slide: 'Lecture Slide',
  past_question: 'Past Question',
  reading: 'Reading Material',
  other: 'Other',
};

const TYPE_COLORS: Record<CourseMaterialType, 'primary' | 'info' | 'success' | 'secondary'> = {
  slide: 'primary',
  past_question: 'info',
  reading: 'success',
  other: 'secondary',
};

export default function StudentCourseMaterialsPage() {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  useEffect(() => {
    setLoadingCourses(true);
    Promise.all([getCourses({ level: user?.level, perPage: 100 }), getMyRegisteredCourseIDs()])
      .then(([allCourses, registeredIds]) => {
        const registered = new Set(registeredIds);
        const list = allCourses.filter((c) => registered.has(c.id));
        setCourses(list);
        if (list.length > 0) setCourseId(list[0].id);
      })
      .catch(() => notifyError('Error', 'Failed to load courses'))
      .finally(() => setLoadingCourses(false));
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    setLoadingMaterials(true);
    listCourseMaterialsByCourse(courseId)
      .then(setMaterials)
      .catch(() => setMaterials([]))
      .finally(() => setLoadingMaterials(false));
  }, [courseId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Materials</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Lecture slides, past questions, and reading materials shared by your lecturers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-500" />
            <CardTitle>Select a Course</CardTitle>
          </div>
          <CardDescription>Materials update as your lecturers upload them.</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          {loadingCourses ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
          ) : courses.length === 0 ? (
            <p className="text-sm text-surface-400">
              You haven't registered for any courses yet. Register for courses to see their materials here.
            </p>
          ) : (
            <Select
              options={courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.title}` }))}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            />
          )}
        </div>
      </Card>

      {courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materials {materials.length > 0 && `(${materials.length})`}</CardTitle>
          </CardHeader>
          {loadingMaterials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : materials.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-12">No materials uploaded for this course yet.</p>
          ) : (
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary-500/10 text-primary-500 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-surface-900 dark:text-surface-100">{m.title}</p>
                        <Badge variant={TYPE_COLORS[m.material_type]}>{TYPE_LABELS[m.material_type]}</Badge>
                      </div>
                      {m.description && <p className="text-xs text-surface-500 mt-0.5">{m.description}</p>}
                      <p className="text-[10px] text-surface-400 mt-0.5">
                        by {m.uploader_name} · {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={getCourseMaterialDownloadUrl(m.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <Button size="xs" leftIcon={<Download className="w-3.5 h-3.5" />}>
                      Download
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
