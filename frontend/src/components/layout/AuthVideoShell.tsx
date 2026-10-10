import type { ReactNode } from 'react';
import { APP_DESCRIPTION, APP_NAME } from '../../utils/constants';
import { motion } from 'framer-motion';
import CookieConsent from '../feedback/CookieConsent';
import { AdminPackMark } from '../branding/AdminPackMark';
import { DepartmentLogo } from '../branding/DepartmentBrand';
import type { TenantInfo } from '../../types';
import { dimOpacity, resolveLoginTemplate } from '../../config/signInLook';
import { useSignInLook } from '../../hooks/useSignInLook';
import { SignInLookPicker } from '../auth/SignInLookPicker';

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

/** The department's name and institution, in light text, for the photo templates. */
const PhotoCaption = ({ department }: { department: TenantInfo }) => (
  <div className="text-white">
    <p className="text-2xl lg:text-3xl font-bold tracking-tight">{department.name}</p>
    {department.institution && <p className="mt-1 text-sm text-white/70">{department.institution}</p>}
  </div>
);

interface TemplateProps {
  children: ReactNode;
  cardMaxWidth: string;
  picker: ReactNode;
  imageSrc: string;
  /** Overlay strength over the wallpaper, 0 to 1. */
  dim: number;
  department?: TenantInfo;
}

/**
 * Split template: the image fills the left half (a band on top when the screen
 * is narrow), and the form sits on the right.
 */
const SplitShell = ({ children, cardMaxWidth, picker, imageSrc, dim, department }: TemplateProps) => (
  <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-surface-950 select-none">
    <div className="flex flex-1 flex-col md:flex-row">
      <div className="relative h-56 w-full shrink-0 md:h-auto md:min-h-screen md:w-1/2">
        <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black" style={{ opacity: dim }} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950/85 via-surface-950/20 to-transparent" />
        {department && (
          <div className="absolute bottom-0 left-0 p-8 lg:p-12">
            <PhotoCaption department={department} />
          </div>
        )}
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 md:px-12 lg:px-20">
        <div className={`w-full ${cardMaxWidth}`}>
          {picker}
          {children}
        </div>
      </div>
    </div>
    <CookieConsent dark />
  </div>
);

/**
 * Centered template: the image is the full-bleed backdrop, and the form sits in
 * a card in the middle, with the department's logo above it.
 */
const CenteredShell = ({ children, cardMaxWidth, picker, imageSrc, dim, department }: TemplateProps) => (
  <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-surface-950 select-none px-4 py-10">
    <img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-black" style={{ opacity: dim }} />
    <div className="relative z-10 flex w-full flex-col items-center">
      {department && (
        <>
          <DepartmentLogo department={department} className="mb-4 h-20 w-20 rounded-2xl bg-white/90 p-2 shadow-2xl" />
          <p className="mb-6 text-center text-sm font-medium uppercase tracking-[0.2em] text-white/80">
            {department.name}
          </p>
        </>
      )}
      <div className={`w-full ${cardMaxWidth}`}>
        {picker}
        {children}
      </div>
    </div>
    <CookieConsent dark />
  </div>
);

// Shared full-bleed shell for every public auth page (login, signup, password
// reset). The look is chosen on the page itself (the picker above the form) and
// kept on this device: classic (the video background, with the animated logo on
// a desktop-only left panel), split, or centered. Split and centered show the
// wallpaper the person uploaded or created; without one they fall back to classic.
const AuthVideoShell = ({
  children,
  cardMaxWidth = 'max-w-md',
  tagline = APP_DESCRIPTION,
  department,
}: AuthVideoShellProps) => {
  const controls = useSignInLook(department?.slug);
  const { look, wallpaper } = controls;
  const imageSrc = wallpaper?.dataUrl;
  const template = resolveLoginTemplate(look.template, Boolean(imageSrc));
  const picker = <SignInLookPicker controls={controls} />;

  if (template === 'split' && imageSrc) {
    return (
      <SplitShell
        cardMaxWidth={cardMaxWidth}
        picker={picker}
        imageSrc={imageSrc}
        dim={dimOpacity(look.dim)}
        department={department}
      >
        {children}
      </SplitShell>
    );
  }
  if (template === 'centered' && imageSrc) {
    return (
      <CenteredShell
        cardMaxWidth={cardMaxWidth}
        picker={picker}
        imageSrc={imageSrc}
        dim={dimOpacity(look.dim)}
        department={department}
      >
        {children}
      </CenteredShell>
    );
  }

  return (
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

        {/* Card column. The glass panel is hand-rolled (not the shared Card's
            `glass` prop, whose opaque base classes win the cascade) so it stays
            translucent against the video. Text inside is hardcoded light, since
            this shell always sits on a dark background. */}
        <div className={`w-full ${cardMaxWidth}`}>
          {picker}
          {children}
        </div>
      </div>

      <CookieConsent dark />
    </div>
  );
};

export default AuthVideoShell;
