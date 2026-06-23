import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { FileSpreadsheet, Upload, Check, AlertCircle } from 'lucide-react';

interface PreviewRow {
  matricNumber: string;
  name: string;
  ca: number;
  exam: number;
  error?: string;
}

const BulkUploadPage = () => {
  const { success, error } = useNotification();
  const [course, setCourse] = useState('cpe511');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [committing, setCommitting] = useState(false);

  const handleDownloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Matric Number,Name,CA (Max 30),Exam (Max 70)\nENG/2021/001,John Doe,28,52\nENG/2021/002,Jane Smith,22,48';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `grade_template_${course}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Template Downloaded', 'CSV grading template downloaded successfully.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      // Simulate file parsing
      setTimeout(() => {
        setPreviewData([
          { matricNumber: 'ENG/2021/001', name: 'John Doe', ca: 25, exam: 54 },
          { matricNumber: 'ENG/2021/002', name: 'Jane Smith', ca: 32, exam: 40, error: 'CA score exceeds 30' },
          { matricNumber: 'ENG/2021/003', name: 'Bob Alabi', ca: 18, exam: 72, error: 'Exam score exceeds 70' },
        ]);
        success('File Parsed', 'Found 3 grade records. View details below.');
      }, 1000);
    }
  };

  const handleCommit = async () => {
    const hasErrors = previewData.some((r) => r.error);
    if (hasErrors) {
      error('Commit Blocked', 'Please correct all grading sheet row errors before saving.');
      return;
    }

    setCommitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      success('Grades Committed', 'Successfully imported bulk Excel grading list.');
      setFile(null);
      setPreviewData([]);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Bulk Upload Grades</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Import continuous assessment and examination grades using Excel or CSV sheets.
          </p>
        </div>
        <Button variant="outline" leftIcon={<FileSpreadsheet className="w-4 h-4" />} onClick={handleDownloadTemplate}>
          Download CSV Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Settings</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-4">
              <Select
                label="Module Course Code"
                options={[
                  { value: 'cpe511', label: 'CPE 511 (Embedded Systems)' },
                  { value: 'cpe513', label: 'CPE 513 (Computer Architecture II)' },
                ]}
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Upload CSV Sheet</label>
                <div className="border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-xl p-6 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-500/5 transition-colors relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-surface-400 mx-auto mb-2" />
                  <p className="text-xs text-surface-600 dark:text-surface-300 font-semibold">
                    {file ? file.name : 'Click to select CSV'}
                  </p>
                  <p className="text-[10px] text-surface-400 mt-1">Supported: CSV formats up to 5MB</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {previewData.length > 0 && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Parse Preview</CardTitle>
                  <CardDescription>Review imported grades before committing to ledger</CardDescription>
                </div>
                <Button isLoading={committing} onClick={handleCommit} leftIcon={<Check className="w-4 h-4" />}>
                  Save Grades
                </Button>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Matric Number</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-20">CA (30)</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase w-20">Exam (70)</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-150 dark:divide-surface-800/80">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className={row.error ? 'bg-danger-500/5' : ''}>
                        <td className="px-6 py-4 font-semibold text-surface-900 dark:text-white">{row.matricNumber}</td>
                        <td className="px-6 py-4 text-surface-700 dark:text-surface-300">{row.name}</td>
                        <td className="px-6 py-4">{row.ca}</td>
                        <td className="px-6 py-4">{row.exam}</td>
                        <td className="px-6 py-4 text-xs font-semibold">
                          {row.error ? (
                            <span className="flex items-center gap-1 text-danger-500">
                              <AlertCircle className="w-3.5 h-3.5" /> {row.error}
                            </span>
                          ) : (
                            <span className="text-emerald-500">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadPage;
