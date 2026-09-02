import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import CookieConsent from '../feedback/CookieConsent';

interface AuthVideoShellProps {
  children: ReactNode;
  /** Tailwind max-width class for the right-side card column. */
  cardMaxWidth?: string;
  tagline?: string;
}

// Shared full-bleed shell for every public auth page (login, signup, password
// reset) — video background, dimmed for contrast, with the animated logo on
// a desktop-only left panel and the page's own glass card on the right.
// Extracted from the original login page so all auth screens stay visually
// identical without copy-pasting the video/animation markup four times.
const AuthVideoShell = ({
  children,
  cardMaxWidth = 'max-w-md',
  tagline = 'Association of Computer Engineering Students, Uniuyo Chapter',
}: AuthVideoShellProps) => (
  <div className="relative min-h-screen w-full overflow-hidden bg-surface-950 select-none">
    <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" src="/login.mp4" />
    {/* Dims the raw footage so both the left wordmark and the glass card
        keep good contrast regardless of what's playing behind them. */}
    <div className="absolute inset-0 bg-black/50" />
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent-500/20 blur-[120px] pointer-events-none" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary-500/20 blur-[120px] pointer-events-none" />

    <div className="relative z-10 min-h-screen flex flex-col md:flex-row items-center justify-center md:justify-between gap-10 px-4 py-10 md:px-16 lg:px-24">
      {/* Desktop-only left panel — hidden on mobile web per design. */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center">
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
          <motion.img
            src="/aces-logo.png"
            alt="Aces Zone"
            className="relative w-36 h-36 lg:w-48 lg:h-48 object-contain drop-shadow-2xl"
            initial={{ opacity: 0, scale: 0.5, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: 0, y: [0, -10, 0] }}
            transition={{
              opacity: { duration: 0.7 },
              scale: { duration: 0.7, type: 'spring', bounce: 0.45 },
              rotate: { duration: 0.7, type: 'spring', bounce: 0.45 },
              y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.7 },
            }}
          />
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">ACES ZONE</h1>
        <p className="mt-3 max-w-xs text-sm text-white/70">{tagline}</p>
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

    <CookieConsent />
  </div>
);

export default AuthVideoShell;
