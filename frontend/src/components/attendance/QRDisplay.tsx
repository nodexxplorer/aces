import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { attendanceCode } from '../../api/verified-attendance';
import { useAuthStore } from '../../stores/authStore';
import { Copy, Check } from 'lucide-react';

interface QRDisplayProps {
  sessionId: string;
  onError?: (msg: string) => void;
}

export default function QRDisplay({ sessionId, onError }: QRDisplayProps) {
  const tenant = useAuthStore((s) => s.user?.tenant);
  const [qr, setQr] = useState('');
  const [link, setLink] = useState('');
  const [expires, setExpires] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    const tick = async () => {
      try {
        const code = await attendanceCode(sessionId);
        const url = new URL(`/${tenant?.urlCode || 'co'}/i/attendance/checkin`, window.location.origin);
        url.searchParams.set('session', sessionId);
        url.searchParams.set('v', '2');
        url.hash = new URLSearchParams({ challenge: code.challenge }).toString();
        const image = await QRCode.toDataURL(url.toString(), { width: 320, margin: 2, color: { dark: '#1a1a2e' } });
        if (active.current) {
          setQr(image);
          setLink(url.toString());
          setExpires(code.expiresAt);
        }
      } catch (e) {
        if (active.current) {
          setQr('');
          onError?.(e instanceof Error ? e.message : 'Failed to generate QR code');
        }
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 3000);
    return () => {
      active.current = false;
      window.clearInterval(timer);
    };
  }, [sessionId, tenant?.urlCode, onError]);

  // Countdown timer
  useEffect(() => {
    if (!expires) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(expires).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [expires]);

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!qr) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR Code */}
      <div className="relative">
        <img src={qr} alt="Attendance QR code" className="w-72 h-72 rounded-2xl shadow-lg" />
        {/* Countdown ring */}
        <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-white dark:bg-surface-800 shadow-md flex items-center justify-center">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              className="text-surface-200 dark:text-surface-700"
              strokeWidth="2"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              className="text-primary-500"
              strokeWidth="2"
              strokeDasharray={`${(countdown / 59) * 100} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-xs font-bold text-surface-700 dark:text-surface-300">{countdown}s</span>
        </div>
      </div>

      <p className="text-sm text-surface-500 dark:text-surface-400 text-center">
        Code rotates every 59 seconds · Keep this screen visible
      </p>

      <button
        onClick={() => void copyLink()}
        className="inline-flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copied!' : 'Copy check-in link'}
      </button>
    </div>
  );
}
