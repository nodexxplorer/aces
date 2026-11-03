import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Upload } from 'lucide-react';

/**
 * Workbook upload is not connected yet: the server has no endpoint for it and the
 * page has no list of real assignments. The page says so instead of offering
 * made-up assignments or pretending a submission was sent.
 */
const AssignmentUploadPage = () => {
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
        <div className="p-4 pt-0 space-y-4">
          <div
            role="status"
            className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/60 p-4 text-sm text-surface-600 dark:text-surface-300"
          >
            Workbook upload is not available yet. No assignments are listed here, and nothing is sent from this page.
          </div>
          <div className="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl p-6 text-center opacity-60">
            <Upload className="w-8 h-8 text-surface-400 mx-auto mb-2" />
            <p className="text-xs text-surface-500 dark:text-surface-400 font-semibold">ZIP upload unavailable</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AssignmentUploadPage;
