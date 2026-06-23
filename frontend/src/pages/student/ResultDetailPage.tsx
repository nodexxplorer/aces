import { useParams, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { ArrowLeft, BookOpen, User, Award, Calendar } from 'lucide-react';
import GradeBadge from '../../components/data-display/GradeBadge';

const mockCourseDetails = {
  code: 'CPE 513',
  title: 'Computer Architecture II',
  creditUnits: 3,
  level: 5,
  semester: 'first',
  lecturerName: 'Dr. John Doe',
  grade: 'A' as const,
  caScore: 28,
  examScore: 54,
  totalScore: 82,
  remarks: 'Excellent comprehension of computer architecture and assembly programming tasks.',
  dateApproved: 'June 18, 2026',
};

const ResultDetailPage = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <Link to="/results">
        <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Results
        </Button>
      </Link>

      <div className="max-w-2xl mx-auto">
        <Card className="p-8">
          <CardHeader className="border-b border-surface-200 dark:border-surface-700/50 pb-6 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="primary">{mockCourseDetails.code}</Badge>
                <span className="text-xs text-surface-400">Approved Result</span>
              </div>
              <CardTitle className="text-2xl font-bold">{mockCourseDetails.title}</CardTitle>
              <CardDescription>Comprehensive score metrics for ID: {id}</CardDescription>
            </div>
            <GradeBadge grade={mockCourseDetails.grade} />
          </CardHeader>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-sm text-surface-600 dark:text-surface-400">
                <BookOpen className="w-4 h-4 text-primary-500" />
                <span>Credits: {mockCourseDetails.creditUnits} Units</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-surface-600 dark:text-surface-400">
                <User className="w-4 h-4 text-primary-500" />
                <span>Lecturer: {mockCourseDetails.lecturerName}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-sm text-surface-600 dark:text-surface-400">
                <Award className="w-4 h-4 text-primary-500" />
                <span>Total Score: {mockCourseDetails.totalScore} / 100</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-surface-600 dark:text-surface-400">
                <Calendar className="w-4 h-4 text-primary-500" />
                <span>Approved: {mockCourseDetails.dateApproved}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-surface-100 dark:border-surface-800/80 pt-6">
            <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-2">
              Performance Breakdown
            </h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50">
                <p className="text-xs text-surface-400 font-medium">CA Score (30)</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100 mt-1">
                  {mockCourseDetails.caScore}
                </p>
              </div>
              <div className="p-4 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50">
                <p className="text-xs text-surface-400 font-medium">Exam Score (70)</p>
                <p className="text-xl font-bold text-surface-900 dark:text-surface-100 mt-1">
                  {mockCourseDetails.examScore}
                </p>
              </div>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800/40 rounded-xl border border-surface-200/50">
              <p className="text-xs text-surface-400 font-medium mb-1">Lecturer's Remarks</p>
              <p className="text-xs text-surface-700 dark:text-surface-300 leading-relaxed">
                {mockCourseDetails.remarks}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ResultDetailPage;
