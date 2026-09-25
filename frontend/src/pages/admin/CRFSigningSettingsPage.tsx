import { useEffect, useRef, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PenTool, Trash2, Upload, CheckCircle2 } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import {
  listCRFSignatureAssets,
  uploadCRFSignatureAsset,
  deleteCRFSignatureAsset,
  getCRFBacklogPrice,
  updateCRFBacklogPrice,
  type CRFSignatureAsset,
  type CRFSignatureKind,
} from '../../api/crf-signing';

const KIND_LABELS: Record<CRFSignatureKind, string> = {
  hod: 'HOD Signature',
  exam_officer: 'Exam Officer Signature',
};

// The admin's job is now just: provide each authorized signer's signature
// image. Students place/align the signatures on their own course forms (the
// signing area differs per form version and year), preview the stamped
// result, and approve — no more global calibration here.
export default function CRFSigningSettingsPage() {
  const { success, error: notifyError } = useNotification();
  const [assets, setAssets] = useState<CRFSignatureAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<CRFSignatureKind | null>(null);
  const [deleting, setDeleting] = useState<CRFSignatureKind | null>(null);
  const fileInputsRef = useRef<Record<CRFSignatureKind, HTMLInputElement | null>>({ hod: null, exam_officer: null });
  const pendingFilesRef = useRef<Partial<Record<CRFSignatureKind, File>>>({});

  const [backlogPriceInput, setBacklogPriceInput] = useState('1000');
  const [savingBacklogPrice, setSavingBacklogPrice] = useState(false);

  useEffect(() => {
    getCRFBacklogPrice()
      .then((p) => setBacklogPriceInput(String(p.amount_per_backlog)))
      .catch(() => {});
  }, []);

  const handleSaveBacklogPrice = async () => {
    const amount = Number(backlogPriceInput);
    if (!amount || amount <= 0) {
      notifyError('Invalid Amount', 'Enter a positive number.');
      return;
    }
    setSavingBacklogPrice(true);
    try {
      const updated = await updateCRFBacklogPrice(amount);
      setBacklogPriceInput(String(updated.amount_per_backlog));
      success('Saved', 'Backlog fee per form updated.');
    } catch (err: unknown) {
      notifyError('Could Not Save', getErrorMessage(err, 'Please try again'));
    } finally {
      setSavingBacklogPrice(false);
    }
  };

  useEffect(() => {
    listCRFSignatureAssets()
      .then(setAssets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (kind: CRFSignatureKind) => {
    const file = pendingFilesRef.current[kind];
    if (!file) {
      notifyError('Signature Image Required', `Choose an image for ${KIND_LABELS[kind]} first.`);
      return;
    }
    setSaving(kind);
    try {
      const asset = await uploadCRFSignatureAsset(kind, file);
      setAssets((prev) => [...prev.filter((a) => a.kind !== kind), asset]);
      pendingFilesRef.current[kind] = undefined;
      if (fileInputsRef.current[kind]) fileInputsRef.current[kind]!.value = '';
      success('Saved', `${KIND_LABELS[kind]} updated. Students will place it on their own forms.`);
    } catch (err: unknown) {
      notifyError('Save Failed', getErrorMessage(err, 'Could not save signature'));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (kind: CRFSignatureKind) => {
    if (!window.confirm(`Remove the ${KIND_LABELS[kind]}? Students won't be able to place it on their forms until it's re-uploaded.`)) {
      return;
    }
    setDeleting(kind);
    try {
      await deleteCRFSignatureAsset(kind);
      setAssets((prev) => prev.filter((a) => a.kind !== kind));
      success('Removed', `${KIND_LABELS[kind]} removed.`);
    } catch (err: unknown) {
      notifyError('Remove Failed', getErrorMessage(err, 'Could not remove signature'));
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-sm text-surface-400">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <PenTool className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">CRF Signature Setup</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Upload each authorized signer's signature. Students align the signatures on their own course forms and
            approve the stamped result, no calibration needed here.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backlog Fee</CardTitle>
          <CardDescription>
            Price charged per old/unsigned course form a student submits through "Upload Old Course Form". Total = form
            count × this amount, snapshotted at request time (changing it here only affects new requests).
          </CardDescription>
        </CardHeader>
        <div className="flex items-center gap-3">
          <span className="text-sm text-surface-500">₦</span>
          <input
            type="number"
            min={1}
            value={backlogPriceInput}
            onChange={(e) => setBacklogPriceInput(e.target.value)}
            className="w-32 px-3 py-2 text-sm border rounded-lg dark:bg-surface-800 dark:border-surface-700"
          />
          <span className="text-sm text-surface-500">per form</span>
          <Button size="sm" isLoading={savingBacklogPrice} onClick={handleSaveBacklogPrice}>
            Save
          </Button>
        </div>
      </Card>

      {(['hod', 'exam_officer'] as const).map((kind) => {
        const existing = assets.find((a) => a.kind === kind);
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle>{KIND_LABELS[kind]}</CardTitle>
              <CardDescription>
                {existing
                  ? `Configured · last updated ${new Date(existing.uploaded_at).toLocaleString()}`
                  : 'Not uploaded yet'}
              </CardDescription>
            </CardHeader>
            <div className="space-y-3">
              {existing && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/10">
                  <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
                  <img
                    src={`/uploads/${existing.file_path}`}
                    alt={KIND_LABELS[kind]}
                    className="h-10 object-contain"
                  />
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    This is the image students will see and place on their forms.
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                ref={(el) => {
                  fileInputsRef.current[kind] = el;
                }}
                onChange={(e) => {
                  pendingFilesRef.current[kind] = e.target.files?.[0] || undefined;
                }}
                className="w-full text-sm text-surface-600 dark:text-surface-400"
              />
              <p className="text-xs text-surface-400">
                A photo of the signature on plain paper is fine, the paper background is removed automatically, keeping
                the ink's original color. PNG or JPEG.
              </p>
              <div className="flex gap-2">
                <Button isLoading={saving === kind} leftIcon={<Upload className="w-4 h-4" />} onClick={() => handleUpload(kind)}>
                  {existing ? 'Replace' : 'Upload'} {KIND_LABELS[kind]}
                </Button>
                {existing && (
                  <Button variant="danger" isLoading={deleting === kind} leftIcon={<Trash2 className="w-4 h-4" />} onClick={() => handleDelete(kind)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>How signing works now</CardTitle>
        </CardHeader>
        <ol className="list-decimal list-inside text-sm text-surface-600 dark:text-surface-400 space-y-1">
          <li>You upload the HOD's and Exam Officer's signature images (above).</li>
          <li>The student uploads their course registration form PDF.</li>
          <li>The student drags each signature to the exact signing spot on their form, the area differs between form versions and years, so each student aligns their own.</li>
          <li>The student previews the stamped result and approves it; the server then renders the final signed PDF.</li>
        </ol>
      </Card>
    </div>
  );
}
