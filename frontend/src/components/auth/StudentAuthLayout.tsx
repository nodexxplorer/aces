import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, ShieldOff } from 'lucide-react';
import type { Department } from '../../api/departments';
import { DepartmentLogo } from '../branding/DepartmentBrand';
import { AdminParkLogoPlaceholder } from '../branding/AdminParkLogoPlaceholder';
import CookieConsent from '../feedback/CookieConsent';
import DepartmentLogoPicker from './DepartmentLogoPicker';

/** How long each slide stays before the next one. */
export const SLIDE_INTERVAL_MS = 5000;

export const STUDENT_SLIDES = [
  {
    title: 'One home for every engineering department',
    text: 'Admin Park brings the engineering departments together, with one sign-in for all of them.',
  },
  {
    title: 'Your courses, in one place',
    text: 'Register your courses, sign your course forms, and follow attendance and announcements.',
  },
  {
    title: 'Pay your dues without the queue',
    text: 'Check what you owe, pay, and track your payment history.',
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
 * The rotating slides on the left. They move on by themselves every few seconds,
 * stop while the pointer is over them or a control inside has focus, and never
 * move when the person has asked for reduced motion (the dots still work).
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
      className="flex h-full flex-col justify-between gap-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AdminParkLogoPlaceholder className="h-12 w-12 lg:h-14 lg:w-14" />

      {/* Keyed on the slide, so each slide fades in as it mounts; the old one is removed at once. */}
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h2 className="max-w-md text-2xl font-bold tracking-tight text-white lg:text-4xl">{slide.title}</h2>
        <p className="mt-3 max-w-md text-sm text-white/70 lg:text-base">{slide.text}</p>
      </motion.div>

      <div className="flex items-center gap-2" role="group" aria-label="Choose a slide">
        {STUDENT_SLIDES.map((item, i) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

interface StudentAuthLayoutProps {
  departments: Department[];
  selected: string;
  /** False until the person has named a department; the top-left logo stays blank until then. */
  picked: boolean;
  onSelect: (slug: string) => void;
  /** The link on the right, beside the logo picker: sign up on the sign-in page, sign in on the sign-up page. */
  topRight: ReactNode;
  children: ReactNode;
}

/**
 * Split layout for the student sign-in and sign-up pages. The slides sit on the
 * left (stacked above the card on a phone). The right holds the department
 * picker, the link and the card. The selected department's logo sits top-left.
 */
export default function StudentAuthLayout({
  departments,
  selected,
  picked,
  onSelect,
  topRight,
  children,
}: StudentAuthLayoutProps) {
  const current = picked ? departments.find((d) => d.slug === selected) : undefined;

  return (
    <div className="flex min-h-screen w-full flex-col bg-white md:flex-row dark:bg-[#0A1224]">
      <aside className="relative overflow-hidden bg-[#0A1224] text-white md:min-h-screen md:w-1/2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(26,102,214,0.38),transparent_55%)]"
        />
        <div className="relative h-full p-6 md:p-12 lg:p-16">
          <StudentSlides />
        </div>
      </aside>

      <main className="flex flex-1 flex-col px-5 py-6 md:px-10 md:py-10 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {current ? (
            <DepartmentLogo department={current} className="h-11 w-11" />
          ) : (
            <div className="h-11 w-11" aria-hidden="true" />
          )}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3">
            {departments.length > 1 && (
              <DepartmentLogoPicker departments={departments} selected={picked ? selected : ''} onSelect={onSelect} />
            )}
            <div className="whitespace-nowrap text-sm text-[#4A5D7A] dark:text-[#A3B3CC]">{topRight}</div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <CookieConsent />
      </main>
    </div>
  );
}

/** The one sign-in action on the student pages. */
export function ModoolsButton({
  disabled,
  unavailable,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { unavailable: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A66D6] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#134FA8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A66D6] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#5AB0FF] dark:text-[#06182C] dark:hover:bg-[#8CCBFF] dark:focus-visible:ring-[#5AB0FF] dark:focus-visible:ring-offset-[#0A1224]"
      {...props}
    >
      {!unavailable && <GraduationCap className="h-5 w-5" aria-hidden="true" />}
      {unavailable ? 'Modools sign-in unavailable' : 'Continue with Modools'}
    </button>
  );
}

/** A sign-in error, shown above the button. */
export function AuthNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
    >
      <ShieldOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
