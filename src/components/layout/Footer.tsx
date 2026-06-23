import { Link } from 'react-router-dom';
import { APP_NAME, APP_DESCRIPTION } from '../../utils/constants';

const Footer = () => (
  <footer className="bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 py-6 px-8 text-center text-xs text-surface-500 dark:text-surface-400">
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
      <div className="flex items-center gap-4">
        <p className="font-medium">{APP_DESCRIPTION}</p>
        <span className="text-surface-300 dark:text-surface-700">|</span>
        <Link to="/privacy-policy" className="hover:text-primary-500 hover:underline transition-colors">
          Privacy & Cookie Policy
        </Link>
      </div>
    </div>
  </footer>
);

export default Footer;
