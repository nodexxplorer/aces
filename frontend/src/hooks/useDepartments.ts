import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDepartments, type Department } from '../api/departments';
import { getStoredDepartment, storeDepartment } from '../config/department';
import { applyDepartmentAccent } from '../theme/accent';

// Resolves which department a sign-in or sign-up form should use.
//
// The remembered choice wins while it is still an active department. If it is
// not (never chosen, or since deactivated), the server's default department is
// used. An empty slug is sent when the list has not loaded yet, which the
// server also treats as the default.
export function useDepartments() {
  const query = useQuery({
    queryKey: ['departments'],
    queryFn: listDepartments,
    staleTime: 5 * 60 * 1000,
  });

  const departments: Department[] = useMemo(() => query.data ?? [], [query.data]);
  const [chosen, setChosen] = useState<string>(getStoredDepartment);

  const selected = useMemo(() => {
    if (departments.some((d) => d.slug === chosen)) return chosen;
    return departments.find((d) => d.default)?.slug ?? '';
  }, [departments, chosen]);

  const select = useCallback((slug: string) => {
    storeDepartment(slug);
    setChosen(slug);
  }, []);

  // The form takes the colour of the department being chosen. A department with
  // no accent gets the platform colour.
  const accentColor = departments.find((d) => d.slug === selected)?.accentColor;
  useEffect(() => {
    applyDepartmentAccent(accentColor);
  }, [accentColor]);

  return {
    departments,
    selected,
    select,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
