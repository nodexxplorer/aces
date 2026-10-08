interface AdminPackMarkProps {
  className?: string;
}

/**
 * Neutral platform mark for the sign-in pages. It is an inline SVG, so it
 * needs no network request and carries no department branding. Department
 * logos come from the API through DepartmentBrand.
 */
export const AdminPackMark = ({ className }: AdminPackMarkProps) => (
  <svg role="img" aria-label="Admin Pack" viewBox="0 0 128 128" className={className}>
    <rect width="128" height="128" rx="28" fill="#1e293b" />
    <rect x="26" y="30" width="76" height="16" rx="8" fill="#94a3b8" />
    <rect x="26" y="56" width="76" height="16" rx="8" fill="#cbd5e1" />
    <rect x="26" y="82" width="76" height="16" rx="8" fill="#f8fafc" />
  </svg>
);

export default AdminPackMark;
