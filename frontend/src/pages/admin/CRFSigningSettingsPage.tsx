import { useEffect, useRef, useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { PenTool, MousePointerClick } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../utils/errors';
import pdfjsLib from '../../utils/pdfjs';
import {
  listCRFSignatureAssets,
  uploadCRFSignatureAsset,
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

interface KindState {
  file: File | null;
  xPt: number | null;
  yPt: number | null;
  widthPt: number;
}

const DEFAULT_KIND_STATE: KindState = { file: null, xPt: null, yPt: null, widthPt: 100 };

export default function CRFSigningSettingsPage() {
  const { success, error: notifyError } = useNotification();
  const [assets, setAssets] = useState<CRFSignatureAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const viewportRef = useRef<import('pdfjs-dist').PageViewport | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeKind, setActiveKind] = useState<CRFSignatureKind | null>(null);
  const [kindState, setKindState] = useState<Record<CRFSignatureKind, KindState>>({
    hod: { ...DEFAULT_KIND_STATE },
    exam_officer: { ...DEFAULT_KIND_STATE },
  });
  const [saving, setSaving] = useState<CRFSignatureKind | null>(null);
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
    // Render at whatever scale fits a ~700px-wide preview, but keep the
    // viewport's own scale — convertToPdfPoint/convertToViewportPoint below
    // need it to translate between canvas pixels and PDF points.
    const renderScale = 700 / viewport.width;
    const scaledViewport = page.getViewport({ scale: renderScale });
    viewportRef.current = scaledViewport;
    setPageSize({ width: scaledViewport.width, height: scaledViewport.height });

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport }).promise;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeKind || !viewportRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [xPt, yPt] = viewportRef.current.convertToPdfPoint(cx, cy);
    setKindState((prev) => ({ ...prev, [activeKind]: { ...prev[activeKind], xPt, yPt } }));
  };

  const markerViewportPos = (kind: CRFSignatureKind): { left: number; top: number } | null => {
    const st = kindState[kind];
    if (st.xPt == null || st.yPt == null || !viewportRef.current) return null;
    const [vx, vy] = viewportRef.current.convertToViewportPoint(st.xPt, st.yPt);
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
    setSaving(kind);
    try {
      const asset = await uploadCRFSignatureAsset(kind, st.file, {
        page_number: 1,
        x_pt: st.xPt,
        y_pt: st.yPt,
        width_pt: st.widthPt,
      });
      setAssets((prev) => [...prev.filter((a) => a.kind !== kind), asset]);
      success('Saved', `${KIND_LABELS[kind]} updated.`);
    } catch (err: unknown) {
      notifyError('Save Failed', getErrorMessage(err, 'Could not save signature'));
    } finally {
      setSaving(null);
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
              style={{ cursor: activeKind ? 'crosshair' : 'default', display: 'block' }}
            />
            {(['hod', 'exam_officer'] as const).map((kind) => {
              const pos = markerViewportPos(kind);
              if (!pos) return null;
              const st = kindState[kind];
              const pxWidth = viewportRef.current ? st.widthPt * viewportRef.current.scale : 40;
              return (
                <div
                  key={kind}
                  style={{
                    position: 'absolute',
                    left: pos.left,
                    top: pos.top - pxWidth * 0.33,
                    width: pxWidth,
                    height: pxWidth * 0.33,
                    border: `2px dashed ${MARKER_COLORS[kind]}`,
                    pointerEvents: 'none',
                  }}
                  title={KIND_LABELS[kind]}
                />
              );
            })}
          </div>
        )}
        {pageSize && (
          <p className="text-xs text-surface-400 mt-2">
            Blue box = HOD position, red box = Exam Officer position. Select "Place" on a signature below, then click
            the spot on the form.
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Signature Image
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setKindState((prev) => ({ ...prev, [kind]: { ...prev[kind], file: f } }));
                  }}
                  className="w-full text-sm text-surface-600 dark:text-surface-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Width (points)
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
                <Button
                  variant={activeKind === kind ? 'primary' : 'outline'}
                  leftIcon={<MousePointerClick className="w-4 h-4" />}
                  onClick={() => setActiveKind(activeKind === kind ? null : kind)}
                  disabled={!pageSize}
                  className="w-full"
                >
                  {activeKind === kind ? 'Click the form now...' : 'Place on Form'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-surface-400 mt-2">
              {st.xPt != null && st.yPt != null
                ? `Position set: (${st.xPt.toFixed(0)}, ${st.yPt.toFixed(0)}) pt`
                : 'No position set yet — upload a sample form and click "Place on Form".'}
            </p>
            <div className="mt-4">
              <Button isLoading={saving === kind} onClick={() => handleSave(kind)}>
                Save {KIND_LABELS[kind]}
              </Button>
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
