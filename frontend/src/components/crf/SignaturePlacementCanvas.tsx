import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, Loader2 } from 'lucide-react';
import pdfjsLib from '../../utils/pdfjs';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import apiClient from '../../api/client';
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

export type PlacedItemKind = CRFSignatureKind | 'watermark';

export interface SignaturePlacementCanvasProps {
  /** URL of the student's stored original (unstamped) form PDF. */
  pdfUrl: string;
  assets: CRFSignatureAsset[];
  value: CRFPlacements;
  onChange: (next: CRFPlacements) => void;
  fileName?: string;
  snapToLines?: boolean;
  onDraggingKindChange?: (kind: CRFSignatureKind | null) => void;
  studentName?: string;
  matricNumber?: string;
}

/**
 * SignaturePlacementCanvas
 * Renders the student's uploaded form PDF with interactive signature placement overlays,
 * matching the 3-panel signature placement studio.
 */
export default function SignaturePlacementCanvas({
  pdfUrl,
  assets,
  value,
  onChange,
  fileName = 'Course_Form.pdf',
  snapToLines = true,
  onDraggingKindChange,
  studentName,
  matricNumber,
}: SignaturePlacementCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingTaskRef = useRef<ReturnType<typeof pdfjsLib.getDocument> | null>(null);
  const dragKindRef = useRef<PlacedItemKind | null>(null);
  const dragStartOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });
  const resizingKindRef = useRef<CRFSignatureKind | null>(null);
  const resizeStartRef = useRef<{ startX: number; startY: number; startW: number; startH: number }>({
    startX: 0,
    startY: 0,
    startW: 110,
    startH: 34,
  });

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [viewport, setViewport] = useState<{
    width: number;
    height: number;
    convertToPdfPoint: (x: number, y: number) => number[];
  } | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const [draggingKind, setDraggingKind] = useState<PlacedItemKind | null>(null);
  const [selectedKind, setSelectedKind] = useState<PlacedItemKind | null>('exam_officer');

  const renderScale = (zoomPercent / 100) * 1.35;

  // Load the PDF document once
  useEffect(() => {
    let cancelled = false;
    setLoadingPdf(true);
    setPdfLoadError(null);
    setPdfDoc(null);
    setViewport(null);

    (async () => {
      try {
        const res = await apiClient.get(pdfUrl, { responseType: 'arraybuffer' });
        if (cancelled) return;
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(res.data) });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) {
          loadingTask.destroy();
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('Failed to load PDF document:', err);
          setPdfLoadError((err instanceof Error ? err.message : null) || 'Could not load course form PDF.');
        }
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (loadingTaskRef.current) {
        try {
          loadingTaskRef.current.destroy();
        } catch {
          /* ignore destroy errors */
        }
        loadingTaskRef.current = null;
      }
      setPdfDoc(null);
      setViewport(null);
      setNumPages(1);
    };
  }, [pdfUrl]);

  // Render current page when doc, page, or scale changes
  useEffect(() => {
    if (!pdfDoc || loadingPdf) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    (async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;
        const vp = page.getViewport({ scale: renderScale });
        setViewport(vp);

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = vp.width;
        canvas.height = vp.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        renderTask = page.render({ canvas, canvasContext: ctx, viewport: vp });
        await renderTask.promise;
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'RenderingCancelledException') {
          console.error('PDF render error:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore cancel errors */
        }
      }
    };
  }, [pdfDoc, currentPage, renderScale, loadingPdf]);

  const pdfPointFromEvent = useCallback(
    (e: { clientX: number; clientY: number }): [number, number] | null => {
      const canvas = canvasRef.current;
      if (!canvas || !viewport) return null;
      const rect = canvas.getBoundingClientRect();
      const pt = viewport.convertToPdfPoint(e.clientX - rect.left, e.clientY - rect.top);
      return [pt[0], pt[1]] as [number, number];
    },
    [viewport],
  );

  // Drag handlers
  const handlePointerDown = (kind: PlacedItemKind) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore pointer capture errors */
    }
    dragKindRef.current = kind;
    setSelectedKind(kind);
    setDraggingKind(kind);
    if (kind !== 'watermark') {
      onDraggingKindChange?.(kind);
    }

    const pdfPageW = viewport ? viewport.width / renderScale : 595;
    const st =
      kind === 'watermark'
        ? value.watermark || { page: currentPage, x: (pdfPageW - 44) / 2, y: 42, width: 44, max_height: 50 }
        : value[kind];

    if (st) {
      const pt = pdfPointFromEvent(e);
      if (pt) {
        dragStartOffsetRef.current = {
          offsetX: pt[0] - st.x,
          offsetY: pt[1] - st.y,
        };
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Handle box resizing
    if (resizingKindRef.current) {
      const kind = resizingKindRef.current;
      const st = value[kind];
      if (!st) return;
      const deltaX = (e.clientX - resizeStartRef.current.startX) / renderScale;
      const deltaY = (e.clientY - resizeStartRef.current.startY) / renderScale;
      const nextW = Math.max(60, Math.min(260, Math.round(resizeStartRef.current.startW + deltaX)));
      const nextH = Math.max(20, Math.min(90, Math.round(resizeStartRef.current.startH + deltaY)));
      onChange({ ...value, [kind]: { ...st, width: nextW, max_height: nextH } });
      return;
    }

    // 2. Handle position dragging
    const kind = dragKindRef.current;
    if (!kind) return;

    const pdfPageW = viewport ? viewport.width / renderScale : 595;
    const pdfPageH = viewport ? viewport.height / renderScale : 842;
    const st =
      kind === 'watermark'
        ? value.watermark || { page: currentPage, x: (pdfPageW - 44) / 2, y: 42, width: 44, max_height: 50 }
        : value[kind];
    if (!st) return;
    const pt = pdfPointFromEvent(e);
    if (!pt) return;

    let targetX = pt[0] - dragStartOffsetRef.current.offsetX;
    let targetY = pt[1] - dragStartOffsetRef.current.offsetY;

    if (snapToLines) {
      // Subtle 4-pt grid snapping
      targetX = Math.round(targetX / 4) * 4;
      targetY = Math.round(targetY / 4) * 4;
    }

    // Strict boundary clamping within PDF document bounds
    const itemW = st.width || 44;
    const itemH = st.max_height || 34;
    targetX = Math.max(0, Math.min(pdfPageW - itemW, targetX));
    targetY = Math.max(0, Math.min(pdfPageH - itemH, targetY));

    if (kind === 'watermark') {
      onChange({ ...value, watermark: { ...st, x: targetX, y: targetY } });
    } else {
      onChange({ ...value, [kind]: { ...st, x: targetX, y: targetY } });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore release pointer capture errors */
    }
    dragKindRef.current = null;
    resizingKindRef.current = null;
    setDraggingKind(null);
    onDraggingKindChange?.(null);
  };

  const handleResizeStart = (kind: CRFSignatureKind) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const st = value[kind];
    if (!st) return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture error
    }
    resizingKindRef.current = kind;
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: st.width,
      startH: st.max_height || 34,
    };
  };

  // Drop handler for dropping a signature directly from the left palette onto the form
  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const kind = e.dataTransfer.getData('text/plain') as CRFSignatureKind;
    if (kind !== 'hod' && kind !== 'exam_officer') return;
    const pt = pdfPointFromEvent(e);
    if (!pt) return;

    const w = value[kind]?.width || 110;
    const h = value[kind]?.max_height || 34;

    onChange({
      ...value,
      [kind]: {
        page: currentPage,
        x: Math.max(0, Math.round((pt[0] - w / 2) / 4) * 4),
        y: Math.max(0, Math.round((pt[1] - h / 2) / 4) * 4),
        width: w,
        max_height: h,
      },
    });
    setSelectedKind(kind);
  };

  return (
    <div className="w-full flex flex-col">
      {/* ======================================================== */}
      {/* TOP HEADER TOOLBAR (< Page 1 of 1 > | - 100% + | doc)   */}
      {/* ======================================================== */}
      <div className="p-3 border-b border-slate-100 dark:border-[#20232e] bg-slate-50/50 dark:bg-[#13151b] flex items-center justify-between text-xs font-semibold">
        {/* Page Switcher */}
        <div className="flex items-center gap-1.5 border border-slate-200 dark:border-[#282b37] rounded-xl px-2 py-1 bg-white dark:bg-[#181a23]">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#222532] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-[var(--text)] px-1 whitespace-nowrap">
            Page {currentPage} of {numPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#222532] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 border border-slate-200 dark:border-[#282b37] rounded-xl px-2 py-1 bg-white dark:bg-[#181a23]">
          <button
            type="button"
            disabled={zoomPercent <= 60}
            onClick={() => setZoomPercent((z) => Math.max(60, z - 10))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#222532] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-[var(--text)] w-10 text-center font-mono">{zoomPercent}%</span>
          <button
            type="button"
            disabled={zoomPercent >= 160}
            onClick={() => setZoomPercent((z) => Math.min(160, z + 10))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#222532] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* File Name */}
        <span className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-[140px] hidden sm:inline">
          {fileName}
        </span>
      </div>

      {/* ======================================================== */}
      {/* CANVAS VIEWPORT                                          */}
      {/* ======================================================== */}
      <div
        className="p-6 overflow-auto flex items-center justify-center min-h-[560px] bg-slate-100/60 dark:bg-[#0c0d12]"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleCanvasDrop}
      >
        {loadingPdf ? (
          <div className="text-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#1d68ec] mx-auto" />
            <p className="text-xs text-[var(--text-muted)]">Loading course form canvas...</p>
          </div>
        ) : pdfLoadError ? (
          <div className="text-center py-16 space-y-3 max-w-sm">
            <p className="text-xs font-bold text-red-500">{pdfLoadError}</p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Please verify the uploaded course form or try refreshing the page.
            </p>
          </div>
        ) : (
          <div
            className="relative mx-auto shadow-2xl rounded-sm bg-white border border-slate-200 dark:border-[#222530]"
            style={{
              width: viewport ? `${viewport.width}px` : 'fit-content',
              height: viewport ? `${viewport.height}px` : 'fit-content',
              minWidth: viewport ? `${viewport.width}px` : undefined,
              minHeight: viewport ? `${viewport.height}px` : undefined,
            }}
          >
            <canvas
              ref={canvasRef}
              className="block"
              style={{
                width: viewport ? `${viewport.width}px` : undefined,
                height: viewport ? `${viewport.height}px` : undefined,
              }}
            />

            {/* Feint White & Brown QR Anti-Fraud Watermark Preview */}
            {/* Feint White & Brown QR Anti-Fraud Watermark Preview (Positioned at bottom/middle or custom) */}
            {viewport &&
              (() => {
                const wmPt = value.watermark;
                const pdfPageW = viewport.width / renderScale;
                const wmWidthPt = wmPt?.width || 44;
                const wmHeightPt = wmPt?.max_height || 50;

                // Default: bottom center
                const defaultX = (pdfPageW - wmWidthPt) / 2;
                const defaultY = 42;

                const actualX = wmPt?.x ?? defaultX;
                const actualY = wmPt?.y ?? defaultY;

                const [vx, vy] = viewport.convertToViewportPoint(actualX, actualY);
                const wPx = wmWidthPt * renderScale;
                const hPx = wmHeightPt * renderScale;
                const isDraggingWatermark = draggingKind === 'watermark';

                const maxLeft = Math.max(0, viewport.width - wPx);
                const maxTop = Math.max(0, viewport.height - hPx);
                const clampedLeft = Math.max(0, Math.min(maxLeft, vx));
                const clampedTop = Math.max(0, Math.min(maxTop, vy - hPx));

                return (
                  <div
                    className="absolute select-none group cursor-move"
                    style={{
                      left: clampedLeft,
                      top: clampedTop,
                      width: wPx,
                      height: hPx,
                      touchAction: 'none',
                      zIndex: isDraggingWatermark ? 30 : 15,
                    }}
                    onPointerDown={handlePointerDown('watermark')}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    title="Official anti-fraud watermark — Click or drag to reposition"
                  >
                    <div
                      className="w-full h-full bg-white/95 border border-[#653818]/60 rounded-md p-1 shadow-xs flex flex-col items-center justify-between text-center transition-all group-hover:border-[#653818] group-hover:shadow-md"
                      style={{ opacity: isDraggingWatermark ? 0.8 : 0.3 }}
                    >
                      <span className="text-[5px] font-black text-[#653818] tracking-wider leading-none">
                        ACES VERIFIED
                      </span>
                      <div className="w-6 h-6 bg-white flex items-center justify-center p-0.5 my-0.5">
                        <svg className="w-full h-full text-[#653818]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm8-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm11 1h1v1h-1v-1zm-3-3h2v2h-2v-2zm4 0h2v2h-2v-2zm-2 4h2v2h-2v-2zm4-2h2v2h-2v-2zm0 4h2v2h-2v-2zm-2 2h2v2h-2v-2zm4-4h2v2h-2v-2zm-6 2h2v2h-2v-2z" />
                        </svg>
                      </div>
                      <span className="text-[5px] font-black text-[#653818] leading-tight truncate max-w-full uppercase">
                        {studentName || 'STUDENT'}
                      </span>
                      <span className="text-[4.5px] font-semibold text-[#653818]/80 leading-tight truncate max-w-full uppercase">
                        {matricNumber || 'OFFICIAL'}
                      </span>
                    </div>

                    {/* Drag Tooltip */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#653818] text-white text-[9px] font-bold shadow-md whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                      Watermark (drag)
                    </div>
                  </div>
                );
              })()}

            {/* Overlays for Placed Signatures on Current Page */}
            {viewport &&
              (Object.entries(value) as [CRFSignatureKind, CRFPlacement | undefined][]).map(([kind, st]) => {
                // Explicitly ignore watermark so it never renders with Exam Officer labels/overlays
                if ((kind as string) === 'watermark' || !st || (st.page || 1) !== currentPage) return null;
                const asset = assets.find((a) => a.kind === kind);

                const [vx, vy] = viewport.convertToViewportPoint(st.x, st.y);
                const wPx = st.width * renderScale;
                const hPx = (st.max_height || 34) * renderScale;
                const isDraggingThis = draggingKind === kind;
                const isSelectedThis = selectedKind === kind;

                const maxLeft = Math.max(0, viewport.width - wPx);
                const maxTop = Math.max(0, viewport.height - hPx);
                const clampedLeft = Math.max(0, Math.min(maxLeft, vx));
                const clampedTop = Math.max(0, Math.min(maxTop, vy - hPx));

                const labelText =
                  kind === 'hod'
                    ? 'HOD - drag to position'
                    : isDraggingThis
                      ? 'Exam Officer - drop on line'
                      : 'Exam Officer - drag to position';

                return (
                  <div
                    key={kind}
                    className="absolute select-none"
                    style={{
                      left: clampedLeft,
                      top: clampedTop,
                      width: wPx,
                      height: hPx,
                      touchAction: 'none',
                      zIndex: isDraggingThis ? 30 : 20,
                    }}
                    onPointerDown={handlePointerDown(kind)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  >
                    {/* Floating Tooltip Badge */}
                    <div className="absolute -top-6 left-0 z-40 px-2 py-0.5 rounded bg-[#1d68ec] text-white text-[10px] font-bold shadow-md whitespace-nowrap pointer-events-none flex items-center gap-1">
                      <span>{labelText}</span>
                    </div>

                    {/* Bounding Box Border */}
                    <div
                      className={`absolute inset-0 border-2 transition-colors ${
                        isDraggingThis
                          ? 'border-dashed border-[#1d68ec] bg-blue-500/10'
                          : isSelectedThis
                            ? 'border-solid border-[#1d68ec] bg-blue-500/5'
                            : 'border-solid border-[#1d68ec]/80'
                      }`}
                      style={{ cursor: isDraggingThis ? 'grabbing' : 'grab' }}
                    />

                    {/* Corner Resize / Anchor Handles */}
                    <span className="w-2 h-2 bg-white border border-[#1d68ec] absolute -top-1 -left-1 shadow-xs pointer-events-none" />
                    <span className="w-2 h-2 bg-white border border-[#1d68ec] absolute -top-1 -right-1 shadow-xs pointer-events-none" />
                    <span className="w-2 h-2 bg-white border border-[#1d68ec] absolute -bottom-1 -left-1 shadow-xs pointer-events-none" />
                    <span
                      className="w-3 h-3 bg-white border-2 border-[#1d68ec] absolute -bottom-1.5 -right-1.5 shadow-xs cursor-nwse-resize z-50 rounded-xs"
                      title="Drag to resize signature"
                      onPointerDown={handleResizeStart(kind)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    />

                    {/* Signature Image or Fallback Vector */}
                    {asset && asset.file_path ? (
                      <img
                        src={getCRFSignatureImageUrl(asset.file_path) ?? ''}
                        alt={KIND_LABELS[kind]}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-1 pointer-events-none select-none bg-blue-500/5">
                        <svg
                          className="w-full h-full text-[#1d68ec]"
                          viewBox="0 0 100 30"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            d={
                              kind === 'hod'
                                ? 'M 5,20 Q 20,5 35,20 T 65,20 T 95,15'
                                : 'M 5,22 Q 25,2 45,22 T 75,10 T 95,20'
                            }
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
