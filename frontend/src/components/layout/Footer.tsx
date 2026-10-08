import { Link } from 'react-router-dom';
import { APP_NAME, APP_DESCRIPTION } from '../../utils/constants';
import { DepartmentLogo } from '../branding/DepartmentBrand';
import { useCurrentDepartment } from '../branding/department';

const Footer = () => {
  const department = useCurrentDepartment();
  const displayName = department?.name ?? APP_NAME;

  return (
    <footer className="bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 py-6 px-8 md:pr-20 text-xs text-surface-500 dark:text-surface-400">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex items-start gap-3 max-w-xl">
          {department && <DepartmentLogo department={department} className="w-10 h-10 shadow-sm" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">{displayName}</p>
            {department?.institution && <p>{department.institution}</p>}
            <p className="mt-1">{department?.description ?? APP_DESCRIPTION}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 md:text-right">
          <p>
            &copy; {new Date().getFullYear()} {displayName}.{department && ` Powered by ${APP_NAME}.`}
          </p>
          <span className="hidden sm:inline text-surface-300 dark:text-surface-700">|</span>
          <Link to="/privacy-policy" className="hover:text-primary-500 hover:underline transition-colors">
            Privacy & Cookie Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
