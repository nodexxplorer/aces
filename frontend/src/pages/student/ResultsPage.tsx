import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import DataTable from '../../components/data-display/DataTable';
import GradeBadge from '../../components/data-display/GradeBadge';
import { calculateGPA } from '../../utils/cgpa';
import type { Result } from '../../types';
import Button from '../../components/ui/Button';
import { Printer } from 'lucide-react';

const mockResults: Result[] = [
  {
    id: 'res-1',
    studentId: 'stud-1',
    courseId: 'c-1',
    sessionId: '2025/2026',
    semester: 'first',
    caScore: 28,
    examScore: 54,
    totalScore: 82,
    grade: 'A',
    gradePoints: 5,
    isApproved: true,
    createdAt: '',
    course: {
      id: 'c-1',
      code: 'CPE 513',
      title: 'Computer Architecture II',
      creditUnits: 3,
      level: 5,
      semester: 'first',
      subcategory: 'core',
      department: 'Computer Eng',
      isActive: true,
      createdAt: '',
    },
  },
  {
    id: 'res-2',
    studentId: 'stud-1',
    courseId: 'c-2',
    sessionId: '2025/2026',
    semester: 'first',
    caScore: 22,
    examScore: 41,
    totalScore: 63,
    grade: 'B',
    gradePoints: 4,
    isApproved: true,
    createdAt: '',
    course: {
      id: 'c-2',
      code: 'EEE 511',
      title: 'Control Engineering I',
      creditUnits: 3,
      level: 5,
      semester: 'first',
      subcategory: 'core',
      department: 'Electrical Eng',
      isActive: true,
      createdAt: '',
    },
  },
];

const ResultsPage = () => {
  const [level, setLevel] = useState('5');
  const [semester, setSemester] = useState('first');

  const filteredResults = mockResults.filter(
    (r) => r.course?.level === parseInt(level) && r.semester === semester
  );

  const gpa = calculateGPA(filteredResults);

  const columns = [
    { key: 'code', label: 'Course Code', sortable: true, render: (_: unknown, row: Result) => row.course?.code },
    { key: 'title', label: 'Course Title', render: (_: unknown, row: Result) => row.course?.title },
    { key: 'creditUnits', label: 'Credits', render: (_: unknown, row: Result) => row.course?.creditUnits },
    { key: 'caScore', label: 'CA (30)' },
    { key: 'examScore', label: 'Exam (70)' },
    { key: 'totalScore', label: 'Total (100)' },
    { key: 'grade', label: 'Grade', render: (val: unknown) => <GradeBadge grade={val as 'A' | 'B' | 'C' | 'D' | 'E' | 'F'} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Results</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Track and print your semester-by-semester grades.
          </p>
        </div>
        <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
          Print Results
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center gap-4">
            <div className="flex-1">
              <CardTitle>Grades Table</CardTitle>
              <CardDescription>Filtered list of registered academic scores</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select
                placeholder="Level"
                options={[
                  { value: '1', label: '100 Level' },
                  { value: '2', label: '200 Level' },
                  { value: '3', label: '300 Level' },
                  { value: '4', label: '400 Level' },
                  { value: '5', label: '500 Level' },
                ]}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              />
              <Select
                placeholder="Semester"
                options={[
                  { value: 'first', label: 'First Semester' },
                  { value: 'second', label: 'Second Semester' },
                ]}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              />
            </div>
          </CardHeader>
          
          <DataTable
            columns={columns as any}
            data={filteredResults as any}
            emptyTitle="No results found for selection"
            emptyDescription="Ensure you have completed registration and your course scores have been entered and approved."
          />
        </Card>

        <div className="space-y-6">
          <Card className="text-center p-6 bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20">
            <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">
              Semester GPA
            </h4>
            <p className="text-5xl font-extrabold text-primary-600 dark:text-primary-400">
              {gpa.toFixed(2)}
            </p>
            <p className="text-xs text-surface-400 mt-2">
              Based on {filteredResults.reduce((acc, curr) => acc + (curr.course?.creditUnits || 0), 0)} registered credits
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
