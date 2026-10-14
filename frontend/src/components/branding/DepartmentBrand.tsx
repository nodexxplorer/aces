import { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { TenantInfo } from '../../types';
import { departmentLogoUrl, getDepartmentLocalLogo, formatDepartmentDisplayName } from './department';

interface DepartmentLogoProps {
  department?: Partial<TenantInfo>;
  className?: string;
}

/**
 * The department's logo. Uses the API logo or the bundled department logo
 * from branding/department-logos. A department without any logo gets a neutral badge.
 */
export function DepartmentLogo({ department, className = 'w-8 h-8' }: DepartmentLogoProps) {
  const localLogo = getDepartmentLocalLogo(department);
  const apiSrc = departmentLogoUrl(department?.logoUrl);
  const primarySrc = apiSrc || localLogo;

  // Remember which source failed, not a flag, so a different logo gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);

  // If primarySrc was the API logo and failed, fall back to local bundled logo
  const effectiveSrc = failedSrc && failedSrc === apiSrc && localLogo ? localLogo : primarySrc;

  if (!effectiveSrc || effectiveSrc === failedSrc) {
    return (
      <div
        role="img"
        aria-label={department?.name ?? 'Department'}
        className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-300`}
      >
        <Building2 aria-hidden="true" className="w-1/2 h-1/2" />
      </div>
    );
  }
  const alt = department?.name ? `${department.name} logo` : 'Department logo';
  return (
    <img
      src={effectiveSrc}
      alt={alt}
      onError={() => setFailedSrc(effectiveSrc)}
      className={`${className} shrink-0 rounded-lg object-contain`}
    />
  );
}

interface DepartmentBrandProps {
  department?: TenantInfo;
}

/**
 * Logo, name, institution and description of a department. Shown on the
 * sign-in and sign-up cards, which sit on a dark background, so the text is light.
 */
export function DepartmentBrand({ department }: DepartmentBrandProps) {
  if (!department) return null;
  return (
    <div className="flex items-start gap-3">
      <DepartmentLogo department={department} className="w-12 h-12 shadow-md" />
      <div className="min-w-0">
        <p className="font-semibold text-white">{formatDepartmentDisplayName(department.name)}</p>
        {department.institution && department.institution !== 'University of Uyo' && (
          <p className="text-xs text-white/60">{department.institution}</p>
        )}
        {department.description && <p className="mt-1 text-sm text-white/75">{department.description}</p>}
      </div>
    </div>
  );
}
