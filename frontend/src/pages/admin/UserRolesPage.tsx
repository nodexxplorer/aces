import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import UserManagementPage from './UserManagementPage';

/**
 * UserRolesPage delegates directly to the unified People & Access hub (UserManagementPage),
 * defaulting to the 'roles' tab if no tab parameter is explicitly specified.
 */
export default function UserRolesPage() {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (!params.get('tab')) {
      setParams({ tab: 'roles' });
    }
  }, [params, setParams]);

  return <UserManagementPage />;
}
