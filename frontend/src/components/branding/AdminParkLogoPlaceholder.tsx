/**
 * Stand-in for the Admin Park logo, shown on the student sign-in slides until
 * the real logo is supplied. Replace the body of this component with the logo
 * image; the size and position are set by the caller.
 */
export function AdminParkLogoPlaceholder({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Admin Park logo (placeholder)"
      className={`${className} flex items-center justify-center rounded-2xl border border-dashed border-white/35 bg-white/5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60`}
    >
      Logo
    </div>
  );
}

export default AdminParkLogoPlaceholder;
