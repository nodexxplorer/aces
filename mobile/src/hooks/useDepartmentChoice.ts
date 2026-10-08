import { useCallback, useEffect, useState } from 'react';
import { listDepartments, pickInitialDepartment, type Department } from '../api/tenants';
import { getStoredDepartment } from '../store/departmentStore';
import { getErrorMessage } from '../utils/errors';

/** The department list and the chosen department slug, for a sign-in or sign-up screen. */
export function useDepartmentChoice() {
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

  return { departments, slug, setSlug, loading, error, reload: load };
}
