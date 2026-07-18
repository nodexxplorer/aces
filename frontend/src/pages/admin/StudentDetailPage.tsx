import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getUser, getStudentCGPA } from '../../api/users';
import { getStudentResults } from '../../api/results';
import { useNotification } from '../../hooks/useNotification';
import { ArrowLeft, Mail, Phone, Calendar, Shield, CheckCircle, XCircle, GraduationCap, BookOpen, Award, Loader2 } from 'lucide-react';
import type { User as UserType } from '../../types';

const StudentDetailPage = () => {
  const { id } = useParams();
  const { error: notifyError } = useNotification();
  const [studentUser, setStudentUser] = useState<UserType | null>(null);
  const [cgpa, setCgpa] = useState<{ cgpa: number; scale: number } | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getUser(id)
      .then((user) => {
        setStudentUser(user);
        return Promise.allSettled([
          getStudentCGPA(id).catch(() => null),
          getStudentResults(id).catch(() => []),
        ]);
      })
      .then(([cgpaResult, resultsResult]) => {
        if (cgpaResult.status === 'fulfilled' && cgpaResult.value) setCgpa(cgpaResult.value);
        if (resultsResult.status === 'fulfilled') setResults(resultsResult.value || []);
      })
      .catch(() => notifyError('Error', 'Failed to load student details'))
      .finally(() => { setLoading(false); setResultsLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="ml-2 text-sm text-surface-500">Loading student details...</span>
      </div>
    );
  }

  if (!studentUser) {
    return (
      <div className="space-y-6 max-w-xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold">Student Not Found</h2>
        <p className="text-surface-500">The student record you are looking for does not exist.</p>
        <Link to="/admin/users">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to User Directory
          </Button>
        </Link>
      </div>
    );
  }

  const fullName = studentUser.fullName || `${studentUser.firstName || ''} ${studentUser.lastName || ''}`.trim() || studentUser.email;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/admin/users">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to User Directory
        </Button>
      </Link>

      {/* Profile Header */}
      <Card glass className="p-8">
        <CardHeader className="border-b border-surface-200 dark:border-surface-700/50 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={studentUser.isActive ? 'success' : 'danger'}>
                  {studentUser.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {!studentUser.isApproved && (
                  <Badge variant="warning">Pending Approval</Badge>
                )}
                <span className="text-xs text-surface-400">Student Profile</span>
              </div>
              <CardTitle className="text-2xl font-bold">{fullName}</CardTitle>
              <CardDescription>System ID: {studentUser.id}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Mail className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Email Address</p>
                <p>{studentUser.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Phone className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Phone Number</p>
                <p>{studentUser.phone || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Shield className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Approval Status</p>
                <p className="flex items-center gap-1.5 mt-0.5">
                  {studentUser.isApproved ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-success-500" />
                      <span className="text-success-600 dark:text-success-400 font-medium">Approved</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-danger-500" />
                      <span className="text-danger-600 dark:text-danger-400 font-medium">Pending Approval</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
              <Calendar className="w-5 h-5 text-primary-500" />
              <div>
                <p className="text-xs text-surface-400 font-medium">Member Since</p>
                <p>{studentUser.createdAt ? new Date(studentUser.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}</p>
              </div>
            </div>

            {cgpa && (
              <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
                <GraduationCap className="w-5 h-5 text-primary-500" />
                <div>
                  <p className="text-xs text-surface-400 font-medium">CGPA</p>
                  <p className="font-bold text-lg">
                    {cgpa.cgpa.toFixed(2)} <span className="text-xs font-normal text-surface-400">/ {cgpa.scale}</span>
                  </p>
                </div>
              </div>
            )}

            {studentUser.roles && studentUser.roles.length > 0 && (
              <div className="flex items-center gap-3 text-sm text-surface-700 dark:text-surface-300">
                <BookOpen className="w-5 h-5 text-primary-500" />
                <div>
                  <p className="text-xs text-surface-400 font-medium">Role</p>
                  <p className="capitalize">{studentUser.role || studentUser.activeRole}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Academic Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-500" />
            <CardTitle>Recent Results</CardTitle>
          </div>
          <CardDescription>Academic performance history</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          {resultsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading results...</span>
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-6">No results recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">CA</th>
                    <th className="px-3 py-2">Exam</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                  {results.slice(0, 10).map((r: any) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium">{r.courseCode || r.course?.code || 'N/A'}</td>
                      <td className="px-3 py-2">{r.caScore ?? '-'}</td>
                      <td className="px-3 py-2">{r.examScore ?? '-'}</td>
                      <td className="px-3 py-2 font-semibold">{r.totalScore ?? '-'}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.grade === 'F' ? 'danger' : 'success'}>{r.grade}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StudentDetailPage;
