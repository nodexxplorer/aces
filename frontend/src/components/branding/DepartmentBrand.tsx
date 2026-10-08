import type { TenantInfo } from '../../types';
import { departmentLogoUrl } from './department';

/** Platform mark, shown when a department has no logo. */
const FALLBACK_LOGO = '/aces-logo.png';

interface DepartmentLogoProps {
  department?: Pick<TenantInfo, 'name' | 'logoUrl'>;
  className?: string;
}

/** The department's logo, or the platform mark when it has none. */
export function DepartmentLogo({ department, className = 'w-8 h-8' }: DepartmentLogoProps) {
  const src = departmentLogoUrl(department?.logoUrl) ?? FALLBACK_LOGO;
  const alt = department?.name ? `${department.name} logo` : 'Logo';
  return <img src={src} alt={alt} className={`${className} rounded-lg object-contain`} />;
}

interface DepartmentBrandProps {
  department?: TenantInfo;
}

/** Logo, name, institution and description of a department, for sign-in and sign-up pages. */
export function DepartmentBrand({ department }: DepartmentBrandProps) {
  if (!department) return null;
  return (
    <div className="flex items-start gap-3">
      <DepartmentLogo department={department} className="w-12 h-12 shadow-md" />
      <div className="min-w-0">
        <p className="font-semibold text-surface-900 dark:text-white">{department.name}</p>
        {department.institution && (
          <p className="text-xs text-surface-500 dark:text-surface-400">{department.institution}</p>
        )}
        {department.description && (
          <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">{department.description}</p>
        )}
      </div>
    </div>
  );
}
