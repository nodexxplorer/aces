import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ShieldOff, Sun, Moon } from 'lucide-react';
import type { Department } from '../../api/departments';
import CookieConsent from '../feedback/CookieConsent';
import { useDarkMode } from '../../hooks/useDarkMode';

/** How long each slide stays before the next one. */
export const SLIDE_INTERVAL_MS = 5000;

export const STUDENT_SLIDES = [
  {
    title: 'One Platform for All Engineering Departments',
    text: 'Admin pack brings every engineering department together with a unified academic hub and streamlined access.',
  },
  {
    title: 'Instant Course Registration & CRF Signing',
    text: 'Register semester courses, track CRF signatures, and monitor prerequisites without the paperwork queues.',
  },
  {
    title: 'Pay Dues & Track Verifications Fast',
    text: 'Check what you owe, complete dues payment, and get immediate digital clearance and payment history.',
  },
  {
    title: 'Smart Attendance & QR Code Scanner',
    text: 'Real-time lecture attendance with fraud-resistant scanning and live academic eligibility tracking.',
  },
] as const;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * The rotating slides on the compact dark showcase panel.
 */
export function StudentSlides() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % STUDENT_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion]);

  const slide = STUDENT_SLIDES[index];

  return (
    <div
      className="flex w-full flex-col items-center text-center select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative min-h-[120px] w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full"
          >
            <h2 className="mx-auto max-w-xs text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">
              {slide.title}
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-[#a0a6b0]">{slide.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination indicators */}
      <div className="mt-6 flex items-center gap-1.5" role="group" aria-label="Choose a slide">
        {STUDENT_SLIDES.map((item, i) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              i === index ? 'w-6 bg-white shadow-sm' : 'w-1.5 bg-white/30 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

interface StudentAuthLayoutProps {
  departments?: Department[];
  selected?: string;
  picked?: boolean;
  onSelect?: (slug: string) => void;
  topRight: ReactNode;
  children: ReactNode;
}

/**
 * Split layout for student authentication pages.
 * The left dark panel is compact (~34% width), while the right form panel
 * enjoys the primary visual focus (~66% width) with spacious padding.
 */
export default function StudentAuthLayout({ topRight, children }: StudentAuthLayoutProps) {
  const { isDark, toggle } = useDarkMode();
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-3 md:p-2 bg-[var(--bg)] transition-colors duration-200">
      {/* Outer Card Frame */}
      <div className="relative mx-auto flex w-full max-w-sm sm:max-w-md md:max-w-full flex-col overflow-hidden rounded-[24px] sm:rounded-[32px] border border-[var(--border)] bg-white dark:bg-[#1c1e22] shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.55)] md:flex-row md:min-h-[670px]">
        {/* Left Panel: Compact Dark Showcase (shown on desktop, hidden on mobile) */}
        <aside className="relative hidden md:flex flex-col justify-between overflow-hidden bg-[#0d0e10] p-6 sm:p-8 md:w-[35%] lg:w-[33%] shrink-0 text-white">
          {/* Subtle brand ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(26,102,214,0.38)_0%,rgba(79,155,255,0.15)_40%,transparent_70%)] blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(26,102,214,0.15)_0%,transparent_60%)] blur-2xl"
          />

          {/* Top Tag */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-wider text-white/50 uppercase">Admin Pack</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#4cc38a] animate-pulse" />
              <span className="text-[10px] font-medium text-white/60">Live</span>
            </div>
          </div>

          {/* Center Showcase: Squircle logo & rotating carousel */}
          <div className="relative z-10 my-10 flex flex-col items-center pt-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-5 flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-2xl border border-white/10 bg-[#16181d] p-1 shadow-xl backdrop-blur-md ring-1 ring-white/5"
            >
              <img
                src="/Adminpack.png"
                alt="Adminpack Logo"
                className="h-full w-full object-contain filter drop-shadow"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </motion.div>

            <StudentSlides />
          </div>

          {/* Left Panel Footer */}
          {/* <div className="relative z-10 text-center text-[10px] text-white/40">
            <span>Association of Computer & Engineering Students</span>
          </div> */}
        </aside>

        {/* Right Panel: Spacious Main Area (larger than left panel) */}
        <main className="flex flex-1 flex-col justify-between bg-white p-5 sm:p-8 lg:p-7 lg:px-12 dark:bg-[#1c1e22] transition-colors duration-200">
          {/* Top Bar: Brand Logo & Sign Up / Sign In Switch */}
          <div className="flex items-center justify-between border-b border-[var(--border)]/40 pb-3 sm:pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)]/70 overflow-hidden">
                <img
                  src="/Adminpack.png"
                  alt="Adminpack"
                  className="h-6 w-6  object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <span className="text-xs font-bold tracking-tight text-[var(--text)]">ADMIN PACK</span>
            </div>

            <div className="whitespace-nowrap text-xs text-[var(--text-muted)]">{topRight}</div>
          </div>

          {/* Center Form Content */}
          <div className="my-auto flex flex-1 items-center justify-center py-4 sm:py-6 lg:py-8">
            <div className="w-full max-w-md">{children}</div>
          </div>

          {/* Bottom Footer: Copyright, Policy & Theme Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]/40 pt-4 text-xs text-[var(--text-muted)]">
            <span className="font-medium">© {currentYear} Admin Pack</span>

            <div className="flex items-center gap-4">
              <Link to="/privacy-policy" className="transition-colors hover:text-[var(--text)] hover:underline">
                Privacy Policy
              </Link>
              <Link to="/support" className="transition-colors hover:text-[var(--text)] hover:underline">
                Support
              </Link>
              <button
                type="button"
                onClick={toggle}
                aria-label="Toggle dark mode"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <CookieConsent />
        </main>
      </div>
    </div>
  );
}

/** The primary SSO action on the student pages. */
export function ModoolsButton({
  disabled,
  unavailable,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { unavailable: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="group relative flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 text-sm font-semibold shadow-md transition-all duration-150 select-none bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {!unavailable && <GraduationCap className="h-5 w-5" aria-hidden="true" />}
      <span>{unavailable ? 'Modools sign-in unavailable' : 'Continue with Modools'}</span>
    </button>
  );
}

/** A sign-in error banner shown above the action button. */
export function AuthNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[var(--error)]/30 bg-red-50/80 p-3.5 text-xs sm:text-sm font-medium text-[var(--error)] dark:bg-red-950/25 dark:border-red-900/50 dark:text-red-300"
    >
      <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--error)]" aria-hidden="true" />
      <p className="flex-1">{message}</p>
    </div>
  );
}
