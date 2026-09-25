import { useEffect, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SignaturePlacementCanvas from '../../components/crf/SignaturePlacementCanvas';
import { FileSignature, Download, CheckCircle2, Info, History, CreditCard, Eye, Save, Loader2 } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/errors';
import { Link } from 'react-router-dom';
import { initializeCheckout, getMyDues, checkDuePaid } from '../../api/payments';
import { getSessions, listSessionSemesters } from '../../api/sessions';
import type { SemesterEntry } from '../../types';
import {
  getMyCRFSubmission,
  uploadCRF,
  listMyCRFDrafts,
  saveCRFPlacements,
  previewCRFSubmission,
  approveCRFSubmission,
  getCRFDownloadUrl,
  getCRFOriginalUrl,
  listCRFSignatureAssets,
  getCRFBacklogPrice,
  createCRFBacklogRequest,
  getMyCRFBacklogStatus,
  submitCRFBacklogForm,
  type CRFSigningSubmission,
  type CRFBacklogRequest,
  type CRFSignatureAsset,
  type CRFPlacements,
} from '../../api/crf-signing';

export default function CourseFormSigningPage() {
  const { success, error: notifyError } = useNotification();
  const { user } = useAuth();

  // Current-semester CRF: a draft while the student is placing signatures,
  // completed once they approve.
  const [submission, setSubmission] = useState<CRFSigningSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [assets, setAssets] = useState<CRFSignatureAsset[]>([]);
  const [placements, setPlacements] = useState<CRFPlacements>({});
  const [savingPlacements, setSavingPlacements] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Backlog: old/unsigned course forms from past semesters.
  const [backlogPrice, setBacklogPrice] = useState(1000);
  const [backlog, setBacklog] = useState<CRFBacklogRequest | null>(null);
  const [requestCount, setRequestCount] = useState(1);
  const [requestingBacklog, setRequestingBacklog] = useState(false);
  const [pastSemesters, setPastSemesters] = useState<SemesterEntry[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [backlogFile, setBacklogFile] = useState<File | null>(null);
  const [uploadingBacklog, setUploadingBacklog] = useState(false);
  const [unpaidDues, setUnpaidDues] = useState<string[]>([]);
  const [duesChecked, setDuesChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const checkDues = async () => {
      try {
        const dues = await getMyDues(user?.level);
        const requiredDues = dues.filter((d) => d.is_active && (d.type === 'dept_dues' || d.type === 'class_dues'));
        const results = await Promise.all(
          requiredDues.map(async (d) => {
            try {
              const status = await checkDuePaid(d.id);
              return status.is_paid ? null : d.name;
            } catch {
              return null;
            }
          }),
        );
        if (!cancelled) setUnpaidDues(results.filter((n): n is string => !!n));
      } catch {
        // don't block the page on this — the backend still enforces it on submit
      } finally {
        if (!cancelled) setDuesChecked(true);
      }
    };
    checkDues();
    return () => {
      cancelled = true;
    };
  }, [user?.level]);

  useEffect(() => {
    getMyCRFSubmission()
      .then((sub) => {
        setSubmission(sub);
        if (sub) setPlacements(sub.placements ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    listCRFSignatureAssets()
      .then(setAssets)
      .catch(() => {});

    getCRFBacklogPrice()
      .then((p) => setBacklogPrice(Number(p.amount_per_backlog)))
      .catch(() => {});

    getMyCRFBacklogStatus()
      .then(setBacklog)
      .catch(() => {});

    getSessions()
      .then(async (sessions) => {
        const lists = await Promise.all(sessions.map((s) => listSessionSemesters(s.id).catch(() => [] as SemesterEntry[])));
        const past = lists.flat().filter((sem) => !sem.is_active);
        setPastSemesters(past);
      })
      .catch(() => {});

    // Surface any stray drafts (e.g. a backlog upload made earlier) so the
    // student can resume aligning them. The current-semester draft, if any,
    // is already loaded via /mine.
    listMyCRFDrafts()
      .then((drafts) => {
        if (drafts.length > 0) {
          const current = drafts[0];
          setSubmission((prev) => prev ?? current);
          setPlacements((prev) => (Object.keys(prev).length > 0 ? prev : current.placements ?? {}));
        }
      })
      .catch(() => {});
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    if (unpaidDues.length > 0) {
      notifyError('Outstanding Dues', 'Pay your outstanding dues before your course form can be signed.');
      return;
    }
    setUploading(true);
    try {
      const draft = await uploadCRF(file);
      setSubmission(draft);
      setPlacements(draft.placements ?? {});
      setFile(null);
      success('Form Uploaded', 'Now drag each signature to the right spot on your form.');
    } catch (err: unknown) {
      notifyError('Could Not Upload Form', getErrorMessage(err, 'Please try again'));
    } finally {
      setUploading(false);
    }
  };

  const handleSavePlacements = async () => {
    if (!submission) return;
    if (Object.keys(placements).length === 0) {
      notifyError('Nothing Placed Yet', 'Add at least one signature to your form first.');
      return;
    }
    setSavingPlacements(true);
    try {
      const updated = await saveCRFPlacements(submission.id, placements);
      setSubmission(updated);
      success('Placement Saved', 'Your signature alignment has been saved.');
    } catch (err: unknown) {
      notifyError('Could Not Save', getErrorMessage(err, 'Please try again'));
    } finally {
      setSavingPlacements(false);
    }
  };

  const handlePreview = async () => {
    if (!submission) return;
    setPreviewing(true);
    try {
      // Make sure the server stamps from the current on-screen alignment.
      await saveCRFPlacements(submission.id, placements);
      const blob = await previewCRFSubmission(submission.id);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err: unknown) {
      notifyError('Preview Failed', getErrorMessage(err, 'Could not generate the preview'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleApprove = async () => {
    if (!submission) return;
    if (!window.confirm('Approve and sign this form? This is final — one signed form per semester.')) return;
    setApproving(true);
    try {
      // The preview already saved these placements; save again defensively in
      // case the student tweaked positions after previewing.
      await saveCRFPlacements(submission.id, placements);
      const final = await approveCRFSubmission(submission.id);
      setSubmission(final);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      success('Signed', 'Your course form has been signed and submitted.');
    } catch (err: unknown) {
      notifyError('Could Not Sign Form', getErrorMessage(err, 'Please try again'));
    } finally {
      setApproving(false);
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
      const draft = await submitCRFBacklogForm(backlogFile, selectedSemesterId);
      success('Form Uploaded', 'Now drag each signature to the right spot, then preview and approve.');
      setBacklogFile(null);
      setSelectedSemesterId('');
      const updated = await getMyCRFBacklogStatus();
      setBacklog(updated);
      // Jump into the placement flow for this backlog draft.
      setSubmission(draft);
      setPlacements(draft.placements ?? {});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      notifyError('Could Not Upload Form', getErrorMessage(err, 'Please try again'));
    } finally {
      setUploadingBacklog(false);
    }
  };

  const remainingSlots = backlog ? backlog.requested_count - backlog.forms_submitted : 0;
  const isDraft = submission?.status === 'draft';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <FileSignature className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Course Form Signing</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Upload your course registration form, place the HOD and Exam Officer signatures exactly where your form
            asks for them, check the preview, then approve.
          </p>
        </div>
      </div>

      {duesChecked && unpaidDues.length > 0 && (
        <Card className="p-4 border-danger-500/30 bg-danger-500/5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-danger-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-danger-700 dark:text-danger-400">
                Outstanding dues must be paid before your course form can be signed
              </p>
              <p className="text-xs text-danger-600/80 dark:text-danger-400/80 mt-0.5">Unpaid: {unpaidDues.join(', ')}</p>
            </div>
            <Link to="/payments">
              <Button size="sm" variant="danger" leftIcon={<CreditCard className="w-4 h-4" />}>
                Go to Payments
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="animate-pulse text-sm text-surface-400">Loading...</div>
      ) : submission && submission.status === 'completed' ? (
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
      ) : submission && isDraft ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>1. Align the Signatures on Your Form</CardTitle>
              <CardDescription>
                Every form year is different — drag each signature to the exact signing spot on YOUR form, resize it to
                fit, and place the date where the form asks for it.
              </CardDescription>
            </CardHeader>
            {assets.length === 0 ? (
              <p className="text-sm text-warning-600">
                No signatures have been uploaded by the department yet — check back once the HOD's and Exam Officer's
                signatures are configured.
              </p>
            ) : (
              <SignaturePlacementCanvas
                pdfUrl={getCRFOriginalUrl(submission.id)}
                assets={assets}
                value={placements}
                onChange={setPlacements}
              />
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Preview &amp; Approve</CardTitle>
              <CardDescription>The preview is rendered by the same server stamper used at signing — what you see is exactly what you get.</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" leftIcon={<Save className="w-4 h-4" />} isLoading={savingPlacements} onClick={handleSavePlacements}>
                Save Placement
              </Button>
              <Button leftIcon={<Eye className="w-4 h-4" />} isLoading={previewing} onClick={handlePreview} disabled={Object.keys(placements).length === 0}>
                Preview Signed Form
              </Button>
              <Button variant="success" leftIcon={<CheckCircle2 className="w-4 h-4" />} isLoading={approving} onClick={handleApprove} disabled={Object.keys(placements).length === 0}>
                Approve &amp; Sign
              </Button>
            </div>
            {previewUrl && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-surface-500 mb-2">Preview — scroll to check every page:</p>
                <iframe title="Signed form preview" src={previewUrl} className="w-full h-[600px] border border-surface-200 dark:border-surface-700 rounded-lg" />
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:underline mt-1 inline-block">
                  Open preview in a new tab
                </a>
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Upload Your Course Form</CardTitle>
            <CardDescription>Only PDF files are accepted. You can only sign one form per semester.</CardDescription>
          </CardHeader>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-surface-600 dark:text-surface-400 mb-4"
          />
          <Button isLoading={uploading} disabled={!file || unpaidDues.length > 0} onClick={handleUpload}>
            Upload &amp; Continue to Signing
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
                <span className="font-semibold text-surface-900 dark:text-white">₦{(requestCount * backlogPrice).toLocaleString()}</span>
              </span>
            </div>
            <Button isLoading={requestingBacklog} onClick={handlePayForBacklog} leftIcon={<CreditCard className="w-4 h-4" />}>
              Pay &amp; Unlock Upload Slot{requestCount > 1 ? 's' : ''}
            </Button>
          </div>
        ) : backlog.status === 'pending_payment' ? (
          <div className="space-y-3">
            <p className="text-sm text-warning-600 dark:text-warning-400">
              You have a pending backlog payment of ₦{Number(backlog.amount).toLocaleString()} for {backlog.requested_count} form(s).
              Complete payment to unlock uploading.
            </p>
            <Button isLoading={requestingBacklog} onClick={handleResumeBacklogPayment} leftIcon={<CreditCard className="w-4 h-4" />}>
              Complete Payment
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-success-600 dark:text-success-400">
              {backlog.forms_submitted} of {backlog.requested_count} backlog form(s) submitted, {remainingSlots} slot(s) remaining.
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
            <Button isLoading={uploadingBacklog} disabled={!backlogFile || !selectedSemesterId} onClick={handleSubmitBacklogForm}>
              Upload &amp; Continue to Signing
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
