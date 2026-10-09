import { lazy } from 'react';
import { useParams } from 'react-router-dom';
import { useDepartments } from '../../hooks/useDepartments';
import { departmentByUrlCode } from '../../config/department';

const LoginPage = lazy(() => import('./LoginPage'));
const StaffPortalLoginPage = lazy(() => import('./StaffPortalLoginPage'));
const NotFoundPage = lazy(() => import('../shared/NotFoundPage'));

/**
 * A department's own sign-in address. /:code opens the student sign-in and
 * /:code/admin the staff sign-in, each with that department chosen. An address
 * that names no active department shows the not-found page. The router's
 * suspense boundary covers the lazy pages.
 */
export default function DepartmentEntry({ admin }: { admin: boolean }) {
  const { code = '' } = useParams();
  const { departments, isLoading, isError } = useDepartments(code);

  if (isLoading) return null;
  if (!isError && !departmentByUrlCode(departments, code)) return <NotFoundPage />;
  return admin ? <StaffPortalLoginPage urlCode={code} /> : <LoginPage urlCode={code} />;
}
