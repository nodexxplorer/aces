import { useCallback, useEffect, useState } from 'react';
import { findDepartmentByCode, listDepartments, pickInitialDepartment, type Department } from '../api/tenants';
import { getStoredDepartment } from '../store/departmentStore';
import { getErrorMessage } from '../utils/errors';

/**
 * The department list and the chosen department slug, for a sign-in or sign-up screen.
 * `code` is a department's short name from a link (/co, aceszone://co). When it names
 * a department, that one is chosen, ahead of the one used last time. A code that names
 * none is ignored.
 */
export function useDepartmentChoice(code?: string) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await listDepartments();
      setDepartments(list);
      const initial = pickInitialDepartment(list, await getStoredDepartment());
      setSlug((current) => current || initial?.slug || '');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the departments.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The code is applied whenever it or the list changes: on first load, and when a
  // second link arrives while this screen is open.
  useEffect(() => {
    const match = findDepartmentByCode(departments, code);
    if (match) setSlug(match.slug);
  }, [code, departments]);

  return { departments, slug, setSlug, loading, error, reload: load };
}

export type DepartmentChoice = ReturnType<typeof useDepartmentChoice>;
