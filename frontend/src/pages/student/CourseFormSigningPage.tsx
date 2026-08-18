import { useEffect, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { FileSignature, Download, CheckCircle2 } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import {
  getMyCRFSubmission,
  submitCRFForSigning,
  getCRFDownloadUrl,
  type CRFSigningSubmission,
} from '../../api/crf-signing';

export default function CourseFormSigningPage() {
  const { success, error: notifyError } = useNotification();
  const [submission, setSubmission] = useState<CRFSigningSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getMyCRFSubmission()
      .then(setSubmission)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await submitCRFForSigning(file);
      setSubmission(result);
      success('Signed', 'Your course form has been signed.');
    } catch (err: unknown) {
      notifyError('Could Not Sign Form', getErrorMessage(err, 'Please try again'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <FileSignature className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Course Form Signing</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Upload your course registration form to get the HOD and Exam Officer signatures stamped on automatically.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse text-sm text-surface-400">Loading...</div>
      ) : submission ? (
        <Card className="text-center py-8 space-y-4">
          <CheckCircle2 className="w-12 h-12 text-success-500 mx-auto" />
          <div>
            <p className="font-semibold text-surface-900 dark:text-white">Your course form has been signed</p>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Submitted {new Date(submission.created_at).toLocaleDateString()}. Only one upload is allowed per semester.
            </p>
          </div>
          <a href={getCRFDownloadUrl(submission.id)} target="_blank" rel="noopener noreferrer">
            <Button leftIcon={<Download className="w-4 h-4" />}>Download Signed Form</Button>
          </a>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upload Your Course Form</CardTitle>
            <CardDescription>Only PDF files are accepted. You can only upload once per semester.</CardDescription>
          </CardHeader>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-surface-600 dark:text-surface-400 mb-4"
          />
          <Button isLoading={uploading} disabled={!file} onClick={handleSubmit}>
            Sign My Course Form
          </Button>
        </Card>
      )}
    </div>
  );
}
