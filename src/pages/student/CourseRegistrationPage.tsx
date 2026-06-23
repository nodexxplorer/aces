import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { Check, Plus, AlertCircle, Save } from 'lucide-react';
import type { Course } from '../../types';

const mockCourses: Course[] = [
  { id: 'c-1', code: 'CPE 511', title: 'Embedded Systems Design', creditUnits: 4, level: 5, semester: 'first', subcategory: 'core', department: 'CPE', isActive: true, createdAt: '' },
  { id: 'c-2', code: 'CPE 513', title: 'Computer Architecture II', creditUnits: 3, level: 5, semester: 'first', subcategory: 'core', department: 'CPE', isActive: true, createdAt: '' },
  { id: 'c-3', code: 'EEE 511', title: 'Control Engineering I', creditUnits: 3, level: 5, semester: 'first', subcategory: 'core', department: 'EEE', isActive: true, createdAt: '' },
  { id: 'c-4', code: 'CPE 515', title: 'Artificial Intelligence & Robotics', creditUnits: 3, level: 5, semester: 'first', subcategory: 'elective', department: 'CPE', isActive: true, createdAt: '' },
  { id: 'c-5', code: 'GST 111', title: 'Communication in English', creditUnits: 2, level: 5, semester: 'first', subcategory: 'general', department: 'GST', isActive: true, createdAt: '' },
];

const CourseRegistrationPage = () => {
  const { success, warning } = useNotification();
  const [selectedIds, setSelectedIds] = useState<string[]>(['c-1', 'c-2']);
  const [submitting, setSubmitting] = useState(false);

  const toggleCourse = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedCourses = mockCourses.filter((c) => selectedIds.includes(c.id));
  const totalUnits = selectedCourses.reduce((sum, c) => sum + c.creditUnits, 0);

  const handleSubmit = async () => {
    if (totalUnits < 15) {
      warning('Insufficient Credits', 'You must register at least 15 credit units.');
      return;
    }
    if (totalUnits > 24) {
      warning('Credit Overflow', 'Maximum allowed credit units is 24.');
      return;
    }

    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      success('Registration Successful', `Successfully registered ${selectedCourses.length} courses for the semester.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Course Registration</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Select and register your academic courses for the current semester.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Courses</CardTitle>
              <CardDescription>Select core, elective and general courses</CardDescription>
            </CardHeader>
            <div className="divide-y divide-surface-100 dark:divide-surface-800">
              {mockCourses.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-surface-900 dark:text-white">{c.code}</span>
                        <Badge variant={c.subcategory === 'core' ? 'primary' : 'outline'}>
                          {c.subcategory}
                        </Badge>
                      </div>
                      <p className="text-xs text-surface-500">{c.title}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-surface-400 font-medium">{c.creditUnits} Units</span>
                      <Button
                        size="xs"
                        variant={isSelected ? 'success' : 'outline'}
                        onClick={() => toggleCourse(c.id)}
                        leftIcon={isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      >
                        {isSelected ? 'Selected' : 'Add'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 border border-primary-500/20 bg-primary-500/5">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-2">Registration Status</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Selected Courses</span>
                <span className="font-semibold">{selectedCourses.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Total Credit Units</span>
                <span className="font-semibold text-primary-500">{totalUnits} / 24</span>
              </div>
            </div>

            {totalUnits > 24 && (
              <div className="flex gap-2 p-3 bg-danger-500/10 border border-danger-500/20 text-danger-600 rounded-lg text-xs mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You have exceeded the maximum limit of 24 credit units.</span>
              </div>
            )}

            {totalUnits < 15 && (
              <div className="flex gap-2 p-3 bg-warning-500/10 border border-warning-500/20 text-warning-600 rounded-lg text-xs mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You must select at least 15 credit units to register.</span>
              </div>
            )}

            <Button
              className="w-full"
              isLoading={submitting}
              onClick={handleSubmit}
              disabled={totalUnits < 15 || totalUnits > 24}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Submit Registration
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CourseRegistrationPage;
