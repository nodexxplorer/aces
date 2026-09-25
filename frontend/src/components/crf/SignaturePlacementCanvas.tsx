import { useCallback, useEffect, useRef, useState } from 'react';
import { Move, ZoomIn, ZoomOut, Trash2, Calendar, MousePointerClick } from 'lucide-react';
import pdfjsLib from '../../utils/pdfjs';
import apiClient from '../../api/client';
import Button from '../ui/Button';
import {
  getCRFSignatureImageUrl,
  type CRFPlacement,
  type CRFPlacements,
  type CRFSignatureAsset,
  type CRFSignatureKind,
} from '../../api/crf-signing';

const KIND_LABELS: Record<CRFSignatureKind, string> = {
  hod: 'HOD',
  exam_officer: 'Exam Officer',
};

const MARKER_COLORS: Record<CRFSignatureKind, string> = {
  hod: '#0066CC',
  exam_officer: '#dc2626',
};

const DEFAULT_WIDTH_PT = 110;
const DEFAULT_MAX_HEIGHT_PT = 34;

export interface SignaturePlacementCanvasProps {
  /** URL of the student's stored original (unstamped) form PDF. */
  pdfUrl: string;
  assets: CRFSignatureAsset[];
  value: CRFPlacements;
  onChange: (next: CRFPlacements) => void;
}

/**
 * Renders the student's uploaded form PDF page by page. For each configured
 * signer kind the student drags its signature image anywhere on the form and
 * resizes it, so the stamp lands inside that particular form's signing area
 * (which differs per form version and year). Values are kept in PDF points,
 * converted through the pdfjs render viewport, exactly what the server-side
 * stamper consumes.
 */
export default function SignaturePlacementCanvas({ pdfUrl, assets, value, onChange }: SignaturePlacementCanvasProps) {
  const pageCanvasesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const viewportsRef = useRef<Map<number, import('pdfjs-dist').PageViewport>>(new Map());
  const pdfDocRef = useRef<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<import('pdfjs-dist').PDFDocumentLoadingTask | null>(null);
  const imgCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const dragKindRef = useRef<CRFSignatureKind | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [renderScale, setRenderScale] = useState(1.5);
  const [imagesReady, setImagesReady] = useState(false);
  const [pagesRendered, setPagesRendered] = useState(0);
  const [draggingKind, setDraggingKind] = useState<CRFSignatureKind | null>(null);
  const [pendingDateKind, setPendingDateKind] = useState<CRFSignatureKind | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // Load the PDF document once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(pdfUrl, { responseType: 'arraybuffer' });
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(res.data) });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) {
          loadingTask.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
      } catch {
        setHint('Could not load your form PDF — try refreshing the page.');
      }
    })();
    return () => {
      cancelled = true;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      pdfDocRef.current = null;
      setNumPages(0);
      setPagesRendered(0);
    };
  }, [pdfUrl]);

  // Pre-load the signature images once so overlays can draw them immediately.
  useEffect(() => {
    let cancelled = false;
    setImagesReady(false);
    Promise.all(
      assets.map(
        (a) =>
          new Promise<[string, HTMLImageElement | null]>((resolve) => {
            const img = new Image();
            img.onload = () => resolve([a.kind, img]);
            img.onerror = () => resolve([a.kind, null]);
            img.src = getCRFSignatureImageUrl(a.file_path) ?? '';
          }),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      imgCacheRef.current = Object.fromEntries(pairs.filter(([, img]) => img)) as Record<string, HTMLImageElement>;
      setImagesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [assets]);

  // Render pages whenever the doc, scale, or images change.
  useEffect(() => {
    const doc = pdfDocRef.current;
    if (!doc || !imagesReady) return;
    let cancelled = false;
    (async () => {
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: renderScale });
        viewportsRef.current.set(p, viewport);
        const canvas = pageCanvasesRef.current.get(p);
        if (!canvas || cancelled) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        setPagesRendered((n) => n + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [numPages, renderScale, imagesReady]);

  const pdfPointFromEvent = useCallback(
    (e: { clientX: number; clientY: number }, page: number): [number, number] | null => {
      const canvas = pageCanvasesRef.current.get(page);
      const viewport = viewportsRef.current.get(page);
      if (!canvas || !viewport) return null;
      const rect = canvas.getBoundingClientRect();
      const pt = viewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
      return [pt[0], pt[1]] as [number, number];
    },
    [],
  );

  const updateKind = (kind: CRFSignatureKind, patch: Partial<CRFPlacement>) => {
    const st = value[kind];
    if (!st) return;
    onChange({ ...value, [kind]: { ...st, ...patch } });
  };

  // Drag: pointerdown on the signature's drag pad captures the pointer; move
  // updates the PDF-point position live.
  const handlePointerDown = (kind: CRFSignatureKind) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!value[kind]) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragKindRef.current = kind;
    setDraggingKind(kind);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const kind = dragKindRef.current;
    if (!kind) return;
    const st = value[kind];
    if (!st) return;
    const pt = pdfPointFromEvent(e, st.page || 1);
    if (!pt) return;
    onChange({ ...value, [kind]: { ...st, x: pt[0], y: pt[1] } });
  };

  const handlePointerUp = () => {
    dragKindRef.current = null;
    setDraggingKind(null);
  };

  const addSignature = (kind: CRFSignatureKind, page: number) => {
    onChange({
      ...value,
      [kind]: {
        page,
        x: 72,
        y: 200,
        width: DEFAULT_WIDTH_PT,
        max_height: DEFAULT_MAX_HEIGHT_PT,
        show_date: true,
        date_font_size: 10,
      },
    });
  };

  const removeSignature = (kind: CRFSignatureKind) => {
    const next = { ...value };
    delete next[kind];
    onChange(next);
  };

  const scaleSignature = (kind: CRFSignatureKind, factor: number) => {
    const st = value[kind];
    if (!st) return;
    updateKind(kind, {
      width: Math.max(40, Math.min(300, st.width * factor)),
      max_height: st.max_height ? Math.max(12, Math.min(120, st.max_height * factor)) : st.max_height,
    });
  };

  const toggleDate = (kind: CRFSignatureKind) => {
    const st = value[kind];
    if (!st) return;
    if (st.show_date) {
      updateKind(kind, { show_date: false, date_x: null, date_y: null });
    } else {
      updateKind(kind, { show_date: true, date_font_size: st.date_font_size || 10 });
      setPendingDateKind(kind);
      setHint(`Click the date spot on the form for ${KIND_LABELS[kind]}.`);
    }
  };

  const handleCanvasClick = (page: number) => (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pendingDateKind) return;
    const st = value[pendingDateKind];
    if (!st) {
      setPendingDateKind(null);
      return;
    }
    if ((st.page || 1) !== page) {
      setHint(`${KIND_LABELS[pendingDateKind]}'s signature is on page ${st.page || 1} — click there instead.`);
      return;
    }
    const pt = pdfPointFromEvent(e, page);
    if (!pt) return;
    updateKind(pendingDateKind, { date_x: pt[0], date_y: pt[1] });
    setPendingDateKind(null);
    setHint(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="xs" variant="outline" leftIcon={<ZoomOut className="w-3 h-3" />} onClick={() => setRenderScale((s) => Math.max(0.5, Math.round((s - 0.25) * 100) / 100))}>
          Zoom out
        </Button>
        <Button size="xs" variant="outline" leftIcon={<ZoomIn className="w-3 h-3" />} onClick={() => setRenderScale((s) => Math.min(3, Math.round((s + 0.25) * 100) / 100))}>
          Zoom in
        </Button>
        {hint && <span className="text-xs text-warning-600 flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> {hint}</span>}
      </div>

      <div className="flex flex-wrap gap-3">
        {assets.map((a) => {
          const st = value[a.kind];
          return (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border border-surface-200 dark:border-surface-700">
              <img src={getCRFSignatureImageUrl(a.file_path) ?? ''} alt={KIND_LABELS[a.kind]} className="h-8 object-contain" />
              <div className="text-xs">
                <p className="font-medium">{KIND_LABELS[a.kind]}</p>
                {st ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <button type="button" className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800" title="Smaller" onClick={() => scaleSignature(a.kind, 0.85)}>
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800" title="Larger" onClick={() => scaleSignature(a.kind, 1.18)}>
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className={`p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 ${st.show_date ? 'text-primary-500' : ''}`} title="Toggle date" onClick={() => toggleDate(a.kind)}>
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                    {st.show_date && (
                      <button
                        type="button"
                        className={`p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 ${pendingDateKind === a.kind ? 'text-warning-500' : ''}`}
                        title="Place the date on the form"
                        onClick={() => {
                          setPendingDateKind(a.kind);
                          setHint(`Click the date spot on the form for ${KIND_LABELS[a.kind]}.`);
                        }}
                      >
                        <MousePointerClick className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button type="button" className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-danger-500" title="Remove" onClick={() => removeSignature(a.kind)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <button type="button" className="text-primary-500 hover:underline" onClick={() => addSignature(a.kind, 1)}>
                      Add to page 1
                    </button>
                    {numPages > 1 && (
                      <button type="button" className="text-primary-500 hover:underline" onClick={() => addSignature(a.kind, 2)}>
                        page 2
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pagesRendered > 0 && (
        <div className="space-y-4">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => {
            const viewport = viewportsRef.current.get(page);
            const scale = viewport?.scale ?? renderScale;
            return (
              <div key={page} className="relative mx-auto shadow-lg border border-surface-200 dark:border-surface-700 bg-white" style={{ width: 'fit-content' }}>
                <canvas
                  ref={(el) => {
                    if (el) pageCanvasesRef.current.set(page, el);
                    else pageCanvasesRef.current.delete(page);
                  }}
                  onClick={handleCanvasClick(page)}
                  className="block max-w-full"
                  style={{ cursor: pendingDateKind ? 'crosshair' : 'default' }}
                />
                <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-surface-900/60 text-white">Page {page}</span>

                {(Object.entries(value) as [CRFSignatureKind, CRFPlacement | undefined][]).map(([kind, st]) => {
                  if (!st || (st.page || 1) !== page) return null;
                  const vp = viewportsRef.current.get(page);
                  if (!vp) return null;
                  const asset = assets.find((a) => a.kind === kind);
                  if (!asset) return null;
                  const [vx, vy] = vp.convertToViewportPoint(st.x, st.y);
                  const wPx = st.width * scale;
                  const hPx = (st.max_height || DEFAULT_MAX_HEIGHT_PT) * scale;
                  return (
                    <div key={kind} className="absolute" style={{ left: vx, top: vy - hPx, width: wPx, height: hPx, touchAction: 'none' }}>
                      {/* Drag pad extends slightly beyond the image for easy grabbing */}
                      <div
                        onPointerDown={handlePointerDown(kind)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        className="absolute -inset-2 rounded border-2 border-dashed"
                        style={{
                          borderColor: MARKER_COLORS[kind],
                          cursor: draggingKind === kind ? 'grabbing' : 'grab',
                          opacity: draggingKind === kind ? 1 : 0.75,
                        }}
                        title={`Drag to move the ${KIND_LABELS[kind]} signature`}
                      />
                      <img
                        src={getCRFSignatureImageUrl(asset.file_path) ?? ''}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                      />
                      {st.show_date && st.date_x != null && st.date_y != null && (
                        (() => {
                          const [dx, dy] = vp.convertToViewportPoint(st.date_x, st.date_y);
                          return (
                            <div
                              className="absolute text-[10px] font-medium pointer-events-none"
                              style={{ left: dx, top: dy, color: MARKER_COLORS[kind], transform: 'translateY(-100%)' }}
                            >
                              {new Date().toLocaleDateString('en-GB')}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-surface-400 flex items-center gap-1">
        <Move className="w-3 h-3" /> Drag each signature to move it · size buttons resize it · the calendar icon adds today's date ({new Date().toLocaleDateString('en-GB')}) — click its exact spot on the form.
      </p>
    </div>
  );
}
