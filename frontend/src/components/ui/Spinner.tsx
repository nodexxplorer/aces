import { cn } from '../../utils/cn';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

const Spinner = ({ size = 'md', className }: SpinnerProps) => (
  <div className={cn('border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin', sizes[size], className)} role="status">
    <span className="sr-only">Loading…</span>
  </div>
);

export default Spinner;
