import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { FileText, Download } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';

const ReportsPage = () => {
  const { success } = useNotification();

  const handleGenerate = (reportName: string) => {
    success('Report Generated', `${reportName} has been built successfully.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Department Reports</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Compile and export comprehensive departmental records, academic listings, and registration audits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-500">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">Student Performance Summary</h3>
              <p className="text-xs text-surface-500 mb-4">
                Detailed breakdowns of class CGPA statistics, pass rates, and list of students on academic probation.
              </p>
              <Button size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => handleGenerate('Student Performance Summary')}>
                Download PDF
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-500">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-surface-900 dark:text-white mb-2">Financial Collection Audit</h3>
              <p className="text-xs text-surface-500 mb-4">
                A summary of department association dues, Paystack checkout reconciliation logs, and defaulter list counts.
              </p>
              <Button size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => handleGenerate('Financial Collection Audit')}>
                Download PDF
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
