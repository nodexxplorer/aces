import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';
import { Upload, Check, FileText } from 'lucide-react';

const SubmitAssignmentsPage = () => {
  const { success } = useNotification();
  const [assignment, setAssignment] = useState('asg-1');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      success('Workbooks Submitted', 'Successfully uploaded zip folder of student workbook submissions.');
      setFile(null);
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Submit Lab Workbooks</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Upload bulk zipped files containing student lab worksheets for grading.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workbook Submission Package</CardTitle>
          <CardDescription>Select assignment task and upload collected worksheets</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
          <Select
            label="Select Assignment Target"
            options={[
              { value: 'asg-1', label: 'CPE 511: Embedded System GPIO Architecture Report' },
              { value: 'asg-2', label: 'CPE 513: Computer Architecture Cache Report' },
            ]}
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Zipped Package (.zip)</label>
            <div className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-6 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-colors relative">
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required
              />
              <Upload className="w-8 h-8 text-surface-400 mx-auto mb-2" />
              <p className="text-xs text-surface-600 dark:text-surface-300 font-semibold">
                {file ? file.name : 'Click to select ZIP folder'}
              </p>
              <p className="text-[10px] text-surface-400 mt-1">Consolidated zip containing student files</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Optional Notes</label>
            <textarea
              placeholder="e.g. Contains 74 submissions, 4 late entries..."
              className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Check className="w-4 h-4" />}>
            Upload Submissions
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default SubmitAssignmentsPage;
