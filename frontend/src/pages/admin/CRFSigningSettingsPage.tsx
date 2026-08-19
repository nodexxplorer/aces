import { useEffect, useRef, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PenTool, MousePointerClick, Trash2, Calendar } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import pdfjsLib from '../../utils/pdfjs';
import {
  listCRFSignatureAssets,
  uploadCRFSignatureAsset,
  deleteCRFSignatureAsset,
  testStampCRF,
  type CRFSignatureAsset,
  type CRFSignatureKind,
} from '../../api/crf-signing';

const KIND_LABELS: Record<CRFSignatureKind, string> = {
  hod: 'HOD Signature',
  exam_officer: 'Exam Officer Signature',
};

const MARKER_COLORS: Record<CRFSignatureKind, string> = {
  hod: '#0066CC',
  exam_officer: '#dc2626',
};

type PlaceTarget = 'signature' | 'date';

interface KindState {
  file: File | null;
  xPt: number | null;
  yPt: number | null;
  widthPt: number;
  maxHeightPt: number;
  showDate: boolean;
  dateXPt: number | null;
  dateYPt: number | null;
  dateFontSize: number;
}

const DEFAULT_KIND_STATE: KindState = {
  file: null,
  xPt: null,
  yPt: null,
  widthPt: 100,
  maxHeightPt: 30,
  showDate: true,
  dateXPt: null,
  dateYPt: null,
  dateFontSize: 10,
};

export default function CRFSigningSettingsPage() {
  const { success, error: notifyError } = useNotification();
  const [assets, setAssets] = useState<CRFSignatureAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const viewportRef = useRef<import('pdfjs-dist').PageViewport | null>(null);
  const pdfPageRef = useRef<import('pdfjs-dist').PDFPageProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activePlacement, setActivePlacement] = useState<{ kind: CRFSignatureKind; target: PlaceTarget } | null>(null);
  const [kindState, setKindState] = useState<Record<CRFSignatureKind, KindState>>({
    hod: { ...DEFAULT_KIND_STATE },
    exam_officer: { ...DEFAULT_KIND_STATE },
  });
  const [saving, setSaving] = useState<CRFSignatureKind | null>(null);
  const [deleting, setDeleting] = useState<CRFSignatureKind | null>(null);
  const [testStamping, setTestStamping] = useState(false);

  useEffect(() => {
    listCRFSignatureAssets()
      .then((data) => {
        setAssets(data);
        setKindState((prev) => {
          const next = { ...prev };
          for (const a of data) {
            next[a.kind as CRFSignatureKind] = {
              file: null,
              xPt: a.x_pt,
              yPt: a.y_pt,
              widthPt: a.width_pt,
              maxHeightPt: a.max_height_pt || DEFAULT_KIND_STATE.maxHeightPt,
              showDate: a.show_date,
              dateXPt: a.date_x_pt,
              dateYPt: a.date_y_pt,
              dateFontSize: a.date_font_size || DEFAULT_KIND_STATE.dateFontSize,
            };
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSampleUpload = async (file: File) => {
    setSampleFile(file);
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    const renderScale = 700 / viewport.width;
    const scaledViewport = page.getViewport({ scale: renderScale });
    viewportRef.current = scaledViewport;
    pdfPageRef.current = page;

    setPageSize({ width: scaledViewport.width, height: scaledViewport.height });
  };

  useEffect(() => {
    if (!pageSize || !pdfPageRef.current || !viewportRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = pageSize.width;
    canvas.height = pageSize.height;
    pdfPageRef.current.render({ canvas, canvasContext: ctx, viewport: viewportRef.current });
  }, [pageSize]);

  const handlePlaceClick = (kind: CRFSignatureKind, target: PlaceTarget) => {
    if (!pageSize) {
      notifyError('Upload a Sample Form First', 'Upload a sample form above, then come back and click "Place".');
      return;
    }
    setActivePlacement((prev) => (prev?.kind === kind && prev.target === target ? null : { kind, target }));
    canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activePlacement || !viewportRef.current) return;
    const { kind, target } = activePlacement;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [xPt, yPt] = viewportRef.current.convertToPdfPoint(cx, cy);
    setKindState((prev) => ({
      ...prev,
      [kind]: target === 'signature' ? { ...prev[kind], xPt, yPt } : { ...prev[kind], dateXPt: xPt, dateYPt: yPt },
    }));
  };

  const markerViewportPos = (kind: CRFSignatureKind): { left: number; top: number } | null => {
    const st = kindState[kind];
    if (st.xPt == null || st.yPt == null || !viewportRef.current) return null;
    const [vx, vy] = viewportRef.current.convertToViewportPoint(st.xPt, st.yPt);
    return { left: vx, top: vy };
  };

  const dateMarkerViewportPos = (kind: CRFSignatureKind): { left: number; top: number } | null => {
    const st = kindState[kind];
    if (!st.showDate || st.dateXPt == null || st.dateYPt == null || !viewportRef.current) return null;
    const [vx, vy] = viewportRef.current.convertToViewportPoint(st.dateXPt, st.dateYPt);
    return { left: vx, top: vy };
  };

  const handleSave = async (kind: CRFSignatureKind) => {
    const st = kindState[kind];
    const existing = assets.find((a) => a.kind === kind);
    if (!st.file && !existing) {
      notifyError('Signature Image Required', `Choose an image for ${KIND_LABELS[kind]} first.`);
      return;
    }
    if (st.xPt == null || st.yPt == null) {
      notifyError('Placement Required', `Click on the sample form to place the ${KIND_LABELS[kind]}.`);
      return;
    }
    if (!st.file) {
      notifyError('Signature Image Required', 'Re-select the image file — placement alone can’t be saved without it.');
      return;
    }
    if (st.showDate && (st.dateXPt == null || st.dateYPt == null)) {
      notifyError(
        'Date Placement Required',
        `Click "Place Date" and click the form, or turn off "Show Date" for ${KIND_LABELS[kind]}.`,
      );
      return;
    }
    setSaving(kind);
    try {
      const asset = await uploadCRFSignatureAsset(kind, st.file, {
        page_number: 1,
        x_pt: st.xPt,
        y_pt: st.yPt,
        width_pt: st.widthPt,
        max_height_pt: st.maxHeightPt,
        show_date: st.showDate,
        date_x_pt: st.dateXPt,
        date_y_pt: st.dateYPt,
        date_font_size: st.dateFontSize,
      });
      setAssets((prev) => [...prev.filter((a) => a.kind !== kind), asset]);
      setKindState((prev) => ({ ...prev, [kind]: { ...prev[kind], file: null } }));
      success('Saved', `${KIND_LABELS[kind]} updated.`);
    } catch (err: unknown) {
      notifyError('Save Failed', getErrorMessage(err, 'Could not save signature'));
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (kind: CRFSignatureKind) => {
    if (
      !window.confirm(
        `Remove the ${KIND_LABELS[kind]}? Students uploading a CRF afterward won't get this signature stamped until it's reconfigured.`,
      )
    ) {
      return;
    }
    setDeleting(kind);
    try {
      await deleteCRFSignatureAsset(kind);
      setAssets((prev) => prev.filter((a) => a.kind !== kind));
      setKindState((prev) => ({ ...prev, [kind]: { ...DEFAULT_KIND_STATE } }));
      success('Removed', `${KIND_LABELS[kind]} removed.`);
    } catch (err: unknown) {
      notifyError('Remove Failed', getErrorMessage(err, 'Could not remove signature'));
    } finally {
      setDeleting(null);
    }
  };

  const handleTestStamp = async () => {
    if (!sampleFile) {
      notifyError('Sample Form Required', 'Upload a sample CRF PDF first.');
      return;
    }
    setTestStamping(true);
    try {
      const blob = await testStampCRF(sampleFile);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      notifyError('Test Stamp Failed', getErrorMessage(err, 'Could not stamp the sample form'));
    } finally {
      setTestStamping(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-sm text-surface-400">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-xl">
          <PenTool className="w-6 h-6 text-surface-600 dark:text-surface-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">CRF Signature Setup</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Calibrate where the HOD and Exam Officer signatures land on the course registration form — this placement is
            reused for every student's upload.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Upload a Sample Form</CardTitle>
          <CardDescription>
            A blank/example course registration form PDF, used only to click the signature positions. It won't be saved
            or sent to anyone.
          </CardDescription>
        </CardHeader>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleSampleUpload(f);
          }}
          className="w-full text-sm text-surface-600 dark:text-surface-400"
        />

        {pageSize && (
          <div className="mt-4 relative inline-block border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{ cursor: activePlacement ? 'crosshair' : 'default', display: 'block' }}
            />
            {(['hod', 'exam_officer'] as const).map((kind) => {
              const pos = markerViewportPos(kind);
              const st = kindState[kind];
              const scale = viewportRef.current?.scale ?? 1;
              const pxWidth = st.widthPt * scale;
              const pxHeight = st.maxHeightPt * scale;
              const datePos = dateMarkerViewportPos(kind);
              return (
                <div key={kind}>
                  {pos && (
                    <div
                      style={{
                        position: 'absolute',
                        left: pos.left,
                        top: pos.top - pxHeight,
                        width: pxWidth,
                        height: pxHeight,
                        border: `2px dashed ${MARKER_COLORS[kind]}`,
                        pointerEvents: 'none',
                      }}
                      title={`${KIND_LABELS[kind]} signature`}
                    />
                  )}
                  {datePos && (
                    <div
                      style={{
                        position: 'absolute',
                        left: datePos.left,
                        top: datePos.top - st.dateFontSize * scale,
                        pointerEvents: 'none',
                      }}
                      title={`${KIND_LABELS[kind]} date`}
                    >
                      <Calendar className="w-4 h-4" style={{ color: MARKER_COLORS[kind] }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {pageSize && (
          <p className="text-xs text-surface-400 mt-2">
            Blue = HOD, red = Exam Officer. Dashed box = signature position, calendar icon = date position. Select
            "Place Signature" or "Place Date" below, then click the spot on the form.
          </p>
        )}
      </Card>

      {(['hod', 'exam_officer'] as const).map((kind) => {
        const st = kindState[kind];
        const existing = assets.find((a) => a.kind === kind);
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle>{KIND_LABELS[kind]}</CardTitle>
              <CardDescription>
                {existing
                  ? `Configured · last updated ${new Date(existing.uploaded_at).toLocaleDateString()}`
                  : 'Not configured yet'}
              </CardDescription>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Signature Image
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setKindState((prev) => ({ ...prev, [kind]: { ...prev[kind], file: f } }));
                  }}
                  className="w-full text-sm text-surface-600 dark:text-surface-400"
                />
                <p className="text-xs text-surface-400 mt-1">
                  A photo of the signature on plain paper is fine — the paper background is removed automatically,
                  keeping the ink's original color.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Max Width (points)
                </label>
                <input
                  type="number"
                  min="10"
                  value={st.widthPt}
                  onChange={(e) =>
                    setKindState((prev) => ({ ...prev, [kind]: { ...prev[kind], widthPt: Number(e.target.value) } }))
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Max Height (points)
                </label>
                <input
                  type="number"
                  min="5"
                  value={st.maxHeightPt}
                  onChange={(e) =>
                    setKindState((prev) => ({
                      ...prev,
                      [kind]: { ...prev[kind], maxHeightPt: Number(e.target.value) },
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  variant={
                    activePlacement?.kind === kind && activePlacement.target === 'signature' ? 'primary' : 'outline'
                  }
                  leftIcon={<MousePointerClick className="w-4 h-4" />}
                  onClick={() => handlePlaceClick(kind, 'signature')}
                  className="w-full"
                >
                  {activePlacement?.kind === kind && activePlacement.target === 'signature'
                    ? 'Click the form now...'
                    : 'Place Signature'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-surface-400 mt-2">
              The signature is scaled to fit inside this Width × Height box (keeping its own proportions) so it never
              overflows the signing area on the form — shrink both if the stamped signature comes out larger than the
              printed box.
            </p>
            <p className="text-xs text-surface-400 mt-2">
              {st.xPt != null && st.yPt != null
                ? `Signature position set: (${st.xPt.toFixed(0)}, ${st.yPt.toFixed(0)}) pt`
                : 'No signature position set yet — upload a sample form and click "Place Signature".'}
            </p>

            <div className="mt-5 pt-4 border-t border-surface-150 dark:border-surface-800">
              <label className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">
                <input
                  type="checkbox"
                  checked={st.showDate}
                  onChange={(e) =>
                    setKindState((prev) => ({ ...prev, [kind]: { ...prev[kind], showDate: e.target.checked } }))
                  }
                  className="rounded border-surface-300 dark:border-surface-600"
                />
                Stamp today's date alongside this signature
              </label>

              {st.showDate && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                        Date Font Size (points)
                      </label>
                      <input
                        type="number"
                        min="6"
                        value={st.dateFontSize}
                        onChange={(e) =>
                          setKindState((prev) => ({
                            ...prev,
                            [kind]: { ...prev[kind], dateFontSize: Number(e.target.value) },
                          }))
                        }
                        className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant={
                          activePlacement?.kind === kind && activePlacement.target === 'date' ? 'primary' : 'outline'
                        }
                        leftIcon={<Calendar className="w-4 h-4" />}
                        onClick={() => handlePlaceClick(kind, 'date')}
                        className="w-full"
                      >
                        {activePlacement?.kind === kind && activePlacement.target === 'date'
                          ? 'Click the form now...'
                          : 'Place Date'}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-surface-400 mt-2">
                    {st.dateXPt != null && st.dateYPt != null
                      ? `Date position set: (${st.dateXPt.toFixed(0)}, ${st.dateYPt.toFixed(0)}) pt — shown as today's date at signing time, e.g. "${new Date().toLocaleDateString('en-GB')}".`
                      : 'No date position set yet — click "Place Date" and click the form.'}
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <Button isLoading={saving === kind} onClick={() => handleSave(kind)}>
                Save {KIND_LABELS[kind]}
              </Button>
              {existing && (
                <Button
                  variant="danger"
                  isLoading={deleting === kind}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  onClick={() => handleDelete(kind)}
                >
                  Remove
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>2. Test Stamp</CardTitle>
          <CardDescription>
            Apply the saved signatures to the sample form and open the result to check it.
          </CardDescription>
        </CardHeader>
        <Button isLoading={testStamping} onClick={handleTestStamp} disabled={!sampleFile}>
          Test Stamp Sample Form
        </Button>
      </Card>
    </div>
  );
}
