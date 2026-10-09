import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Card, { CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { departmentSignInPath } from '../../config/department';
import type { TenantInfo } from '../../types';

interface DepartmentAddressesProps {
  department?: Pick<TenantInfo, 'name' | 'urlCode'>;
  /** The address the addresses are built on. Defaults to the origin of the page. */
  origin?: string;
}

/**
 * The web addresses people sign in at: /co for students and /co/admin for staff.
 * Admins give these out, so each one has a copy button. A department with no
 * short address yet is shown the general sign-in pages, with a note.
 */
export function DepartmentAddresses({ department, origin = window.location.origin }: DepartmentAddressesProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const hasCode = Boolean(department?.urlCode);
  const rows = [
    { key: 'students', label: 'Students', url: `${origin}${departmentSignInPath(department, false)}` },
    { key: 'staff', label: 'Staff and admins', url: `${origin}${departmentSignInPath(department, true)}` },
  ];

  const copy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      // The clipboard can be unavailable (an insecure page, or permission
      // denied). The address stays on screen to select and copy by hand.
    }
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sign-in addresses</CardTitle>
          <CardDescription>
            {department?.name ? `Give these to ${department.name}. ` : 'Give these to your department. '}
            Students sign in at the first address; staff and admins at the second.
          </CardDescription>
        </div>
      </CardHeader>

      {!hasCode && (
        <p
          role="note"
          className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
        >
          This department has no short address yet, so people use the general sign-in pages and choose their department
          there. Ask the platform team to set one.
        </p>
      )}

      <ul className="space-y-3">
        {rows.map(({ key, label, url }) => (
          <li
            key={key}
            className="flex flex-col gap-2 rounded-lg border border-surface-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-surface-700"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-surface-500 dark:text-surface-400">
                {label}
              </p>
              <p
                className="truncate font-mono text-sm text-surface-900 dark:text-surface-100"
                data-testid={`address-${key}`}
              >
                {url}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copy(key, url)}
              aria-label={`Copy the ${label.toLowerCase()} address`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-surface-600 dark:text-surface-200 dark:hover:bg-surface-700"
            >
              {copied === key ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : (
                <Copy aria-hidden="true" className="h-4 w-4" />
              )}
              {copied === key ? 'Copied' : 'Copy'}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default DepartmentAddresses;
