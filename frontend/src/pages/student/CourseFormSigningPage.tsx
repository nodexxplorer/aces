import { useEffect, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { FileSignature, Download, CheckCircle2, Info, History, CreditCard } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errors';
import { initializeCheckout } from '../../api/payments';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import type { SemesterEntry } from '../../types';
import {
  getMyCRFSubmission,
  submitCRFForSigning,
  getCRFDownloadUrl,
  getCRFBacklogPrice,
  createCRFBacklogRequest,
  getMyCRFBacklogStatus,
  submitCRFBacklogForm,
  type CRFSigningSubmission,
  type CRFBacklogRequest,
} from '../../api/crf-signing';

export default function CourseFormSigningPage() {
  const { success, error: notifyError } = useNotification();
  const { user } = useAuth();
  const [submission, setSubmission] = useState<CRFSigningSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [backlogPrice, setBacklogPrice] = useState(1000);
  const [backlog, setBacklog] = useState<CRFBacklogRequest | null>(null);
  const [requestCount, setRequestCount] = useState(1);
  const [requestingBacklog, setRequestingBacklog] = useState(false);
  const [pastSemesters, setPastSemesters] = useState<SemesterEntry[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [backlogFile, setBacklogFile] = useState<File | null>(null);
  const [uploadingBacklog, setUploadingBacklog] = useState(false);

  useEffect(() => {
    getMyCRFSubmission()
      .then(setSubmission)
      .catch(() => {})
      .finally(() => setLoading(false));

    getCRFBacklogPrice()
      .then((p) => setBacklogPrice(Number(p.amount_per_backlog)))
      .catch(() => {});

    getMyCRFBacklogStatus()
      .then(setBacklog)
      .catch(() => {});

    getSessions()
      .then(async (sessions) => {
        const lists = await Promise.all(
          sessions.map((s) => listSessionSemesters(s.id).catch(() => [] as SemesterEntry[])),
        );
        const past = lists.flat().filter((sem) => !sem.is_active);
        setPastSemesters(past);
      })
      .catch(() => {});
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

  const handlePayForBacklog = async () => {
    if (!user?.email) {
      notifyError('Checkout Error', 'User email is required.');
      return;
    }
    setRequestingBacklog(true);
    try {
      const { backlog_request, payment } = await createCRFBacklogRequest(requestCount);
      setBacklog(backlog_request);
      const res = await initializeCheckout(payment.id, user.email);
      if (res?.authorization_url) {
        success('Redirecting', 'Forwarding to Paystack to pay for your backlog slot(s)...');
        window.location.href = res.authorization_url;
      } else {
        notifyError('Checkout Error', 'No redirect URL returned.');
      }
    } catch (err: unknown) {
      notifyError('Could Not Start Payment', getErrorMessage(err, 'Please try again'));
    } finally {
      setRequestingBacklog(false);
    }
  };

  const handleResumeBacklogPayment = async () => {
    if (!backlog?.payment_id || !user?.email) return;
    setRequestingBacklog(true);
    try {
      const res = await initializeCheckout(backlog.payment_id, user.email);
      if (res?.authorization_url) {
        window.location.href = res.authorization_url;
      } else {
        notifyError('Checkout Error', 'No redirect URL returned.');
      }
    } catch (err: unknown) {
      notifyError('Could Not Resume Payment', getErrorMessage(err, 'Please try again'));
    } finally {
      setRequestingBacklog(false);
    }
  };

  const handleSubmitBacklogForm = async () => {
    if (!backlogFile || !selectedSemesterId) return;
    setUploadingBacklog(true);
    try {
      await submitCRFBacklogForm(backlogFile, selectedSemesterId);
      success('Signed', 'Your backlog course form has been signed.');
      setBacklogFile(null);
      setSelectedSemesterId('');
      const updated = await getMyCRFBacklogStatus();
      setBacklog(updated);
    } catch (err: unknown) {
      notifyError('Could Not Sign Form', getErrorMessage(err, 'Please try again'));
    } finally {
      setUploadingBacklog(false);
    }
  };

  const remainingSlots = backlog ? backlog.requested_count - backlog.forms_submitted : 0;

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

      <Card className="border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
          <div className="text-sm text-surface-700 dark:text-surface-300">
            <p className="font-semibold text-surface-900 dark:text-white">Current semester is free</p>
            <p className="mt-1 text-surface-600 dark:text-surface-400">
              This service signs your current-semester course form for free, one upload per semester. Have an old,
              unsigned form from a previous semester? Use "Upload Old Course Form" below, a small per-form fee applies
              (₦{backlogPrice.toLocaleString()} per backlog form), payable before the upload slot opens up.
            </p>
          </div>
        </div>
      </Card>

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

      {/* Backlog: old/unsigned course forms from past semesters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> Upload Old Course Form
          </CardTitle>
          <CardDescription>For unsigned course forms from previous semesters. Pay first, then upload.</CardDescription>
        </CardHeader>

        {!backlog || (backlog.status === 'paid' && remainingSlots <= 0) ? (
          <div className="space-y-3">
            {backlog && remainingSlots <= 0 && (
              <p className="text-sm text-success-600 dark:text-success-400">
                You've used all {backlog.requested_count} of your paid backlog slot(s). Need to submit more?
              </p>
            )}
            <label className="block text-xs font-semibold text-surface-500 mb-1">
              How many old course forms do you need to submit?
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={20}
                value={requestCount}
                onChange={(e) => setRequestCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-24 px-3 py-2 text-sm border rounded-lg dark:bg-surface-800 dark:border-surface-700"
              />
              <span className="text-sm text-surface-500">
                Total:{' '}
                <span className="font-semibold text-surface-900 dark:text-white">
                  ₦{(requestCount * backlogPrice).toLocaleString()}
                </span>
              </span>
            </div>
            <Button
              isLoading={requestingBacklog}
              onClick={handlePayForBacklog}
              leftIcon={<CreditCard className="w-4 h-4" />}
            >
              Pay & Unlock Upload Slot{requestCount > 1 ? 's' : ''}
            </Button>
          </div>
        ) : backlog.status === 'pending_payment' ? (
          <div className="space-y-3">
            <p className="text-sm text-warning-600 dark:text-warning-400">
              You have a pending backlog payment of ₦{Number(backlog.amount).toLocaleString()} for{' '}
              {backlog.requested_count} form(s). Complete payment to unlock uploading.
            </p>
            <Button
              isLoading={requestingBacklog}
              onClick={handleResumeBacklogPayment}
              leftIcon={<CreditCard className="w-4 h-4" />}
            >
              Complete Payment
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-success-600 dark:text-success-400">
              {backlog.forms_submitted} of {backlog.requested_count} backlog form(s) submitted, {remainingSlots} slot(s)
              remaining.
            </p>
            <label className="block text-xs font-semibold text-surface-500 mb-1">Which semester is this for?</label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-surface-800 dark:border-surface-700"
            >
              <option value="">Select a past semester...</option>
              {pastSemesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name} ({sem.start_date ? new Date(sem.start_date).getFullYear() : '—'})
                </option>
              ))}
            </select>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setBacklogFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-surface-600 dark:text-surface-400"
            />
            <Button
              isLoading={uploadingBacklog}
              disabled={!backlogFile || !selectedSemesterId}
              onClick={handleSubmitBacklogForm}
            >
              Upload & Sign
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
