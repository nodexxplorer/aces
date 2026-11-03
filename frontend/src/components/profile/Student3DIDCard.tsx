import React, { useState, useRef, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { RotateCcw, Sparkles, Maximize2, RefreshCw } from 'lucide-react';
import { useCurrentDepartment, getDepartmentLocalLogo } from '../branding/department';
import { getMediaUrl } from '../../api/client';
import type { TenantInfo } from '../../types';

interface Student3DIDCardProps {
  fullName: string;
  matricNo: string;
  level: string | number;
  departmentName?: string;
  avatarUrl?: string | null;
  studentId?: string;
  tenant?: Partial<TenantInfo>;
}

// ───── Code 39 Barcode Generator ─────
const CODE39_PATTERNS: Record<string, string> = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  A: '100001001',
  B: '001001001',
  C: '101001000',
  D: '000011001',
  E: '100011000',
  F: '001011000',
  G: '000001101',
  H: '100001100',
  I: '001001100',
  J: '000011100',
  K: '100000011',
  L: '001000011',
  M: '101000010',
  N: '000010011',
  O: '100010010',
  P: '001010010',
  Q: '000000111',
  R: '100000110',
  S: '001000110',
  T: '000010110',
  U: '110000001',
  V: '011000001',
  W: '111000000',
  X: '010010001',
  Y: '110010000',
  Z: '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  '/': '010101000',
  '+': '010100010',
  '%': '000101010',
  $: '010101000',
  '*': '010010100',
};

function BarcodeSVG({ value }: { value: string }) {
  const bars = useMemo(() => {
    // Sanitize input to Code 39 allowed characters
    const clean = (value || 'STUDENT').toUpperCase().replace(/[^0-9A-Z\-./ %$+]/g, '');
    const encodedStr = `*${clean}*`;
    const rects: { x: number; w: number }[] = [];
    let currentX = 0;
    const narrowW = 1.2;
    const wideW = 3.0;
    const gap = 1.2;

    for (let i = 0; i < encodedStr.length; i++) {
      const char = encodedStr[i];
      const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS['-'];
      for (let j = 0; j < 9; j++) {
        const isWide = pattern[j] === '1';
        const w = isWide ? wideW : narrowW;
        if (j % 2 === 0) {
          // Bar
          rects.push({ x: currentX, w });
        }
        currentX += w;
      }
      currentX += gap; // Inter-character gap
    }

    return { rects, totalWidth: currentX };
  }, [value]);

  return (
    <svg viewBox={`0 0 ${bars.totalWidth} 40`} className="w-full h-10 block" preserveAspectRatio="none">
      {bars.rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={40} fill="#0a0f1d" />
      ))}
    </svg>
  );
}

// ───── EMV Gold Chip Component ─────
function EMVGoldChip() {
  return (
    <div className="relative w-10 h-7 rounded-md bg-gradient-to-tr from-[#d4af37] via-[#f7e279] to-[#b38f24] shadow-md border border-[#9b7818]/60 overflow-hidden shrink-0">
      {/* Chip contact traces */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-[#87650f]/60" />
      <div className="absolute inset-y-0 left-1/3 w-[1px] bg-[#87650f]/60" />
      <div className="absolute inset-y-0 right-1/3 w-[1px] bg-[#87650f]/60" />
      <div className="absolute top-1/4 left-1/3 right-1/3 h-1/2 rounded-[2px] border border-[#87650f]/60 bg-gradient-to-br from-[#f8e68b] to-[#cba32e]" />
    </div>
  );
}

// ───── Contactless Waves Icon ─────
function ContactlessWaves() {
  return (
    <svg
      className="w-4 h-4 text-white/90 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M8.5 16.5a5 5 0 0 1 0-9" />
      <path d="M12 19a8.5 8.5 0 0 0 0-14" />
      <path d="M15.5 21.5a12 12 0 0 0 0-19" />
    </svg>
  );
}

export default function Student3DIDCard({
  fullName,
  matricNo,
  level,
  departmentName = 'Computer Engineering',
  avatarUrl,
  studentId,
  tenant,
}: Student3DIDCardProps) {
  const currentDept = useCurrentDepartment();
  const effectiveDept = tenant || currentDept;
  const deptLogoSrc = getDepartmentLocalLogo(effectiveDept) || '/department-logos/EG-CO.png';

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [rotation, setRotation] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFlipped, setIsFlipped] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; rotX: number; rotY: number }>({
    x: 0,
    y: 0,
    rotX: 0,
    rotY: 0,
  });
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Generate QR Code data URL
  useEffect(() => {
    const verifyPayload = `${window.location.origin}/connect?studentId=${studentId || matricNo}&matric=${encodeURIComponent(
      matricNo,
    )}`;
    QRCode.toDataURL(verifyPayload, {
      width: 256,
      margin: 1,
      color: { dark: '#0a0f1d', light: '#ffffff' },
    })
      .then((url) => setQrCodeUrl(url))
      .catch(() => {});
  }, [studentId, matricNo]);

  // Handle Free 3D Drag Rotation (mouse and touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setIsAutoSpinning(false);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX: rotation.x,
      rotY: rotation.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Sensitivity factor
    const factor = 0.55;
    const newRotY = dragStartRef.current.rotY + deltaX * factor;
    // Clamp X rotation between -50 and 50 degrees
    const newRotX = Math.max(-50, Math.min(50, dragStartRef.current.rotX - deltaY * factor));

    setRotation({ x: newRotX, y: newRotY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // Flip 180 degrees smoothly
  const handleToggleFlip = () => {
    setIsAutoSpinning(false);
    const targetY = isFlipped ? 0 : 180;
    setRotation({ x: 0, y: targetY });
    setIsFlipped(!isFlipped);
  };

  // Reset to flat front view
  const handleReset = () => {
    setIsAutoSpinning(false);
    setIsFlipped(false);
    setRotation({ x: 0, y: 0 });
  };

  // Auto-spin animation
  useEffect(() => {
    if (!isAutoSpinning) return;
    let animId: number;
    const spin = () => {
      setRotation((prev) => ({
        x: Math.sin(Date.now() / 1000) * 8,
        y: (prev.y + 0.6) % 360,
      }));
      animId = requestAnimationFrame(spin);
    };
    animId = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(animId);
  }, [isAutoSpinning]);

  // Microtext repeating ticker string
  const microText = useMemo(() => {
    return Array(6).fill('UNIVERSITY OF UYO · STUDENT IDENTITY CARD').join(' · ');
  }, []);

  const displayMatric = matricNo || '—';
  const displayLevel = level || '—';
  const displayName = fullName?.trim() || '—';

  return (
    <div className="space-y-4 select-none">
      {/* 3D Perspective Viewport */}
      <div className="w-full flex items-center justify-center py-4 sm:py-6" style={{ perspective: '1400px' }}>
        <div
          ref={cardContainerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative w-full max-w-[500px] aspect-[1.586/1] touch-none cursor-grab active:cursor-grabbing transition-transform ${
            isDragging ? 'duration-0' : 'duration-500 ease-out'
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          }}
        >
          {/* ========================================================= */}
          {/* FRONT OF THE ID CARD (Matches Page 1 PDF Screenshot)     */}
          {/* ========================================================= */}
          <div
            className="absolute inset-0 rounded-2xl sm:rounded-3xl p-5 sm:p-6 text-white shadow-2xl overflow-hidden border border-white/20 backface-hidden flex flex-col justify-between"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, #0e2a6b 0%, #15459b 40%, #1a57c2 70%, #0e3077 100%)',
            }}
          >
            {/* Background Geometric Circuit Micro-Pattern */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"
              aria-hidden="true"
            />

            {/* Department Logo Watermark (Large centered circular seal) */}
            <div
              className="pointer-events-none absolute -right-8 -bottom-10 w-72 h-72 sm:w-80 sm:h-80 opacity-[0.14] select-none flex items-center justify-center mix-blend-screen"
              aria-hidden="true"
            >
              <img src={deptLogoSrc} alt="" className="w-full h-full object-contain filter grayscale contrast-125" />
            </div>

            {/* Dynamic Specular Sheen (Holographic reflection as card tilts) */}
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-300"
              style={{
                background: `linear-gradient(${105 + rotation.y * 0.8}deg, rgba(255,255,255,${
                  Math.abs(rotation.x) * 0.003 + 0.08
                }) 0%, transparent 45%, rgba(255,255,255,${Math.abs(rotation.y) * 0.002 + 0.15}) 50%, transparent 55%)`,
              }}
              aria-hidden="true"
            />

            {/* Top Row: Institution Name, Department & STUDENT Pill */}
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white leading-tight">
                  UNIVERSITY OF UYO
                </h2>
                <p className="text-[11px] sm:text-xs text-blue-200/90 font-medium leading-tight mt-0.5">
                  Department of {departmentName.replace(/^Department of\s+/i, '')}
                </p>
              </div>

              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-blue-100/90 shrink-0">
                STUDENT
              </span>
            </div>

            {/* Middle Section: Passport Photo + Student Data + QR Code */}
            <div className="relative z-10 grid grid-cols-12 gap-3 sm:gap-4 items-center my-auto">
              {/* Left: Passport Photo (Aspect 35x45) */}
              <div className="col-span-3">
                <div className="w-full aspect-[35/45] rounded-xl sm:rounded-2xl border-2 border-white/40 bg-white/10 overflow-hidden shadow-inner flex flex-col items-center justify-center relative">
                  {avatarUrl ? (
                    <img
                      src={getMediaUrl(avatarUrl) || avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-between p-2 text-center bg-gradient-to-b from-blue-100/20 to-blue-300/30">
                      {/* Avatar silhouette with dashed head circle */}
                      <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-dashed border-blue-200/80 flex items-center justify-center mt-1">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-100/50" />
                      </div>
                      <span className="text-[7px] sm:text-[8px] font-black uppercase text-blue-200 tracking-tighter leading-tight mb-1">
                        PASSPORT PHOTO
                        <br />
                        35 × 45
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle: Name, Matric, Level, Department */}
              <div className="col-span-6 space-y-1.5 sm:space-y-2 pl-0.5">
                <div>
                  <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-blue-200/80">
                    FULL NAME
                  </p>
                  <p className="text-xs sm:text-sm md:text-base font-extrabold uppercase text-white truncate tracking-wide">
                    {displayName}
                  </p>
                </div>

                <div className="grid grid-cols-[3fr_1fr] gap-3">
                  <div className="overflow-hidden">
                    <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-blue-200/80">
                      MATRIC NO.
                    </p>
                    <p className="text-xs sm:text-sm font-extrabold text-white truncate">{displayMatric}</p>
                  </div>

                  <div>
                    <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-blue-200/80">
                      LEVEL
                    </p>
                    <p className="text-xs sm:text-sm font-extrabold text-white">{displayLevel}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-blue-200/80">
                    DEPARTMENT
                  </p>
                  <p className="text-[10px] sm:text-xs font-bold text-white truncate">
                    {departmentName.replace(/^Department of\s+/i, '')}
                  </p>
                </div>
              </div>

              {/* Right: QR Code + SCAN TO VERIFY */}
              <div className="col-span-3 flex flex-col items-center justify-center">
                <div className="p-1 sm:p-1.5 bg-white rounded-xl shadow-lg border border-white/60">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="Verify QR" className="w-16 h-16 sm:w-20 sm:h-20 block rounded-md" />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-md animate-pulse" />
                  )}
                </div>
                <span className="mt-1 text-[8px] sm:text-[9px] font-black uppercase text-blue-100/90 tracking-widest text-center">
                  SCAN TO VERIFY
                </span>
              </div>
            </div>

            {/* Bottom Row: Gold EMV Chip, NFC Contactless & ACES Circular Logo Seal */}
            <div className="relative z-10 flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5">
                <EMVGoldChip />
                <ContactlessWaves />
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-white/95">
                  STUDENT IDENTITY CARD
                </span>
              </div>

              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white/20 p-0.5 shadow-md shrink-0">
                <img
                  src={deptLogoSrc}
                  alt="Department Seal"
                  className="w-full h-full object-contain rounded-full bg-white"
                />
              </div>
            </div>

            {/* Bottom Edge Micro-Text Repeating Ticker */}
            <div className="absolute inset-x-0 bottom-0 py-0.5 overflow-hidden bg-black/25">
              <p className="text-[6.5px] sm:text-[7.5px] text-blue-200/60 font-semibold tracking-wider whitespace-nowrap opacity-80 text-center">
                {microText}
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BACK OF THE ID CARD (Matches Page 2 PDF Screenshot)      */}
          {/* ========================================================= */}
          <div
            className="absolute inset-0 rounded-2xl sm:rounded-3xl text-white shadow-2xl overflow-hidden border border-white/20 flex flex-col justify-between"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'linear-gradient(135deg, #091f52 0%, #113880 40%, #15459b 70%, #0a235b 100%)',
            }}
          >
            {/* Dark Magnetic Stripe Across Top */}
            <div className="w-full h-9 sm:h-11 bg-[#070b16] border-y border-black/50 shadow-inner" />

            {/* Large ACES Department Logo Watermark */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.14] flex items-center justify-center mix-blend-screen"
              aria-hidden="true"
            >
              <img
                src={deptLogoSrc}
                alt=""
                className="w-64 h-64 sm:w-80 sm:h-80 object-contain filter grayscale contrast-125"
              />
            </div>

            {/* Back Card Middle Content */}
            <div className="relative z-10 px-5 sm:px-6 space-y-3">
              {/* Authorized Signature Strip */}
              <div>
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-blue-200/90 mb-1">
                  AUTHORIZED SIGNATURE
                </p>
                <div className="w-full h-8 sm:h-9 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-between px-4 overflow-hidden">
                  <span className="font-serif italic text-xs sm:text-sm text-blue-950/80 tracking-widest select-none">
                    {displayName.toLowerCase()}
                  </span>
                  <span className="text-[9px] font-mono font-semibold text-slate-400">
                    AUTH // {displayMatric.slice(-4)}
                  </span>
                </div>
              </div>

              {/* Disclaimer Property Text */}
              <p className="text-[10px] sm:text-[11px] text-blue-100/90 leading-relaxed max-w-md">
                This card is the property of the University of Uyo and is not transferable. If found, please return it
                to the Department of {departmentName.replace(/^Department of\s+/i, '')}, University of Uyo.
              </p>
            </div>

            {/* Bottom Row: Dept Info (Left) & Barcode Card (Right) */}
            <div className="relative z-10 px-5 sm:px-6 pb-4 sm:pb-5 flex items-end justify-between gap-4">
              {/* Bottom Left: Logo + Univ Name */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-white/20 p-0.5 shadow shrink-0">
                  <img src={deptLogoSrc} alt="Logo" className="w-full h-full object-contain rounded-full bg-white" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white leading-tight">
                    UNIVERSITY OF UYO
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-blue-200/90 leading-tight">
                    Department of {departmentName.replace(/^Department of\s+/i, '')}
                  </p>
                </div>
              </div>

              {/* Bottom Right: Barcode Box */}
              <div className="bg-white rounded-xl p-2 sm:p-2.5 shadow-lg border border-amber-300/40 w-40 sm:w-48 text-center shrink-0">
                <BarcodeSVG value={displayMatric} />
                <p className="font-mono text-[9px] sm:text-[10px] font-extrabold text-[#0a0f1d] tracking-widest mt-0.5">
                  {displayMatric}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 3D Card Controls Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white dark:bg-[#16181d] border border-slate-200 dark:border-[#22252d] rounded-2xl p-2.5 px-3.5 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-primary-500" />
          <span>Interactive 3D Card: Drag to rotate freely</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleFlip}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2a2d39] hover:bg-slate-50 dark:hover:bg-[#20222a] text-xs font-semibold text-[var(--text)] transition-colors"
            title="Flip to other side"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isFlipped ? 'Show Front' : 'Show Back'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAutoSpinning(!isAutoSpinning)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isAutoSpinning
                ? 'bg-primary-600 text-white shadow-sm'
                : 'border border-slate-200 dark:border-[#2a2d39] hover:bg-slate-50 dark:hover:bg-[#20222a] text-[var(--text)]'
            }`}
            title="Toggle 3D continuous rotation"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>{isAutoSpinning ? 'Pause Spin' : 'Auto 3D'}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-[#2a2d39] hover:bg-slate-50 dark:hover:bg-[#20222a] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            title="Reset to default angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
