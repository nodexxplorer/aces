import type { ReactNode } from 'react';
import { APP_DESCRIPTION, APP_NAME } from '../../utils/constants';
import { motion } from 'framer-motion';
import CookieConsent from '../feedback/CookieConsent';
import { AdminPackMark } from '../branding/AdminPackMark';
import { DepartmentLogo } from '../branding/DepartmentBrand';
import type { TenantInfo } from '../../types';

interface AuthVideoShellProps {
  children: ReactNode;
  /** Tailwind max-width class for the right-side card column. */
  cardMaxWidth?: string;
  tagline?: string;
  /**
   * The department chosen on this screen. When given, the left panel shows its
   * logo, name and description, and "Admin Pack" becomes the small platform line.
   */
  department?: TenantInfo;
}

/** The platform mark with its name and tagline. Used when no department is chosen. */
const PlatformMark = ({ tagline }: { tagline: string }) => (
  <>
    <div className="relative mb-6 w-36 h-36 lg:w-48 lg:h-48">
      {/* Slowly-orbiting glow behind the logo — two blurred blobs spun
          around the container rather than a conic-gradient, so it
          renders with plain Tailwind color tokens instead of needing
          arbitrary theme() CSS support. */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-primary-400/50 blur-2xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-accent-400/50 blur-2xl" />
      </motion.div>
      <motion.div
        className="relative w-36 h-36 lg:w-48 lg:h-48 drop-shadow-2xl"
        initial={{ opacity: 0, scale: 0.5, rotate: -25 }}
        animate={{ opacity: 1, scale: 1, rotate: 0, y: [0, -10, 0] }}
        transition={{
          opacity: { duration: 0.7 },
          scale: { duration: 0.7, type: 'spring', bounce: 0.45 },
          rotate: { duration: 0.7, type: 'spring', bounce: 0.45 },
          y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.7 },
        }}
      >
        <AdminPackMark className="h-full w-full" />
      </motion.div>
    </div>
    <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">{APP_NAME}</h1>
    <p className="mt-3 max-w-xs text-sm text-white/70">{tagline}</p>
  </>
);

/**
 * The department's own brand on the left panel. "Admin Pack" is only the small
 * platform line underneath, as the approved entry-screen layout requires.
 */
const DepartmentPanel = ({ department }: { department: TenantInfo }) => (
  <>
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: 'spring', bounce: 0.35 }}
      className="mb-6 drop-shadow-2xl"
    >
      <DepartmentLogo
        department={department}
        className="w-36 h-36 lg:w-44 lg:h-44 rounded-3xl shadow-2xl bg-white/90 p-3"
      />
    </motion.div>
    <h1 className="max-w-sm text-3xl lg:text-4xl font-bold text-white tracking-tight">{department.name}</h1>
    {department.institution && <p className="mt-2 text-sm text-white/60">{department.institution}</p>}
    {department.description && <p className="mt-3 max-w-sm text-sm text-white/75">{department.description}</p>}
    <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-white/45">{APP_NAME}</p>
  </>
);

// Shared full-bleed shell for every public auth page (login, signup, password
// reset) — video background, dimmed for contrast, with the animated logo on
// a desktop-only left panel and the page's own glass card on the right.
// Extracted from the original login page so all auth screens stay visually
// identical without copy-pasting the video/animation markup four times.
const AuthVideoShell = ({
  children,
  cardMaxWidth = 'max-w-md',
  tagline = APP_DESCRIPTION,
  department,
}: AuthVideoShellProps) => (
  <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-surface-950 select-none">
    <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" src="/login.mp4" />
    {/* Dims the raw footage so both the left wordmark and the glass card
        keep good contrast regardless of what's playing behind them. */}
    <div className="absolute inset-0 bg-black/50" />
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-500/20 blur-[120px] pointer-events-none" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-[120px] pointer-events-none" />

    <div className="relative z-10 flex flex-1 flex-col md:flex-row items-center justify-center md:justify-between gap-10 px-4 py-10 md:px-16 lg:px-24">
      {/* Desktop-only left panel — hidden on mobile web per design. */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center">
        {department ? <DepartmentPanel department={department} /> : <PlatformMark tagline={tagline} />}
      </div>

      {/* Card column — hand-rolled glass panel (not the shared Card's
          `glass` prop, whose base opaque bg-white/dark:bg-surface-800
          classes win the cascade over its own glass override and end up
          looking like a plain solid card) so it's genuinely
          translucent/frosted against the video behind it. Text colors
          inside each page's card are hardcoded light rather than
          theme-conditional since this shell always sits on a dark video
          regardless of the app's light/dark preference. */}
      <div className={`w-full ${cardMaxWidth}`}>{children}</div>
    </div>

    <CookieConsent dark />
  </div>
);

export default AuthVideoShell;
