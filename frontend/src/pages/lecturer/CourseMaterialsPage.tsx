import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { listLecturerAssignments, type LecturerAssignment } from '../../api/lecturers';
import {
  uploadCourseMaterial,
  listMyCourseMaterials,
  deleteCourseMaterial,
  getCourseMaterialDownloadUrl,
  type CourseMaterial,
  type CourseMaterialType,
} from '../../api/course-materials';
import { Upload, FileText, Trash2, Download, Loader2, BookOpen } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';

const TYPE_LABELS: Record<CourseMaterialType, string> = {
  slide: 'Lecture Slide',
  past_question: 'Past Question',
  reading: 'Reading Material',
  other: 'Other',
};

export default function LecturerCourseMaterialsPage() {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState<CourseMaterialType>('slide');
  const [file, setFile] = useState<File | null>(null);

  const fetchMaterials = () => {
    listMyCourseMaterials()
      .then(setMaterials)
      .catch(() => {});
  };

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([listLecturerAssignments(user.id).catch(() => []), listMyCourseMaterials().catch(() => [])])
      .then(([ass, mats]) => {
        setAssignments(ass);
        setMaterials(mats);
        if (ass.length > 0) setCourseId(ass[0].course_id);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title.trim() || !file) {
      notifyError('Missing Fields', 'Course, title, and a file are required.');
      return;
    }
    setUploading(true);
    try {
      await uploadCourseMaterial({
        course_id: courseId,
        title: title.trim(),
        description: description || undefined,
        material_type: materialType,
        file,
      });
      success('Uploaded', `${title} is now available to students.`);
      setTitle('');
      setDescription('');
      setFile(null);
      fetchMaterials();
    } catch (err: unknown) {
      notifyError('Upload Failed', getErrorMessage(err, 'Could not upload material'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (material: CourseMaterial) => {
    if (!confirm(`Remove "${material.title}"?`)) return;
    try {
      await deleteCourseMaterial(material.id);
      setMaterials((prev) => prev.filter((m) => m.id !== material.id));
      success('Removed', 'Material removed.');
    } catch {
      notifyError('Error', 'Could not remove material');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Materials</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Share lecture slides, past questions, and reading materials with your students.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-500" />
            <CardTitle>Upload Material</CardTitle>
          </div>
          <CardDescription>Only courses you're assigned to teach appear below.</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpload} className="p-4 pt-0 space-y-4">
          {assignments.length === 0 ? (
            <EmptyState title="You have no course assignments yet." className="py-0" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Course</label>
                <Select
                  options={assignments.map((a) => ({
                    value: a.course_id,
                    label: `${a.course_code} - ${a.course_title}`,
                  }))}
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Type</label>
                <Select
                  options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value as CourseMaterialType)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Title</label>
                <input
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Week 3 Slides — Data Structures"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Description (optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 resize-none"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">File</label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-surface-600 dark:text-surface-400"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" isLoading={uploading} leftIcon={<Upload className="w-4 h-4" />}>
                  Upload
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-500" />
            <CardTitle>Your Uploads ({materials.length})</CardTitle>
          </div>
        </CardHeader>
        {materials.length === 0 ? (
          <EmptyState title="No materials uploaded yet." />
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {materials.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-primary-500/10 text-primary-500 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-surface-900 dark:text-surface-100 truncate">{m.title}</p>
                    <p className="text-xs text-surface-500">
                      {m.course_code} · {TYPE_LABELS[m.material_type]} · {m.download_count} download(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={getCourseMaterialDownloadUrl(m.id)} target="_blank" rel="noopener noreferrer">
                    <Button size="xs" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />}>
                      View
                    </Button>
                  </a>
                  <button onClick={() => handleDelete(m)} className="p-1.5 text-danger-500 hover:text-danger-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
