interface SkeletonProps {
  className?: string;
  lines?: number;
  type?: 'text' | 'card' | 'avatar' | 'table';
}

function Skeleton({ className = '', type = 'text', lines = 1 }: SkeletonProps) {
  const baseClass = 'animate-pulse rounded bg-surface-200 dark:bg-surface-700';

  switch (type) {
    case 'avatar':
      return (
        <div className={`flex items-center gap-4 p-4 ${className}`}>
          <div className={`w-12 h-12 rounded-full ${baseClass}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-4 w-1/3 ${baseClass}`} />
            <div className={`h-3 w-1/4 ${baseClass}`} />
          </div>
        </div>
      );

    case 'card':
      return (
        <div className={`rounded-xl border border-surface-200 dark:border-surface-700 p-6 space-y-4 ${className}`}>
          <div className={`h-6 w-1/3 ${baseClass}`} />
          <div className={`h-4 w-full ${baseClass}`} />
          <div className={`h-4 w-2/3 ${baseClass}`} />
          <div className="flex gap-2 pt-2">
            <div className={`h-8 w-20 rounded-lg ${baseClass}`} />
            <div className={`h-8 w-20 rounded-lg ${baseClass}`} />
          </div>
        </div>
      );

    case 'table':
      return (
        <div className={`rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden ${className}`}>
          <div className={`h-12 ${baseClass} border-b border-surface-200 dark:border-surface-700`} />
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={`h-14 ${baseClass} border-b border-surface-100 dark:border-surface-800 last:border-b-0`}
            />
          ))}
        </div>
      );

    default:
      return (
        <div className={`space-y-2 ${className}`}>
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={`h-4 ${baseClass}`}
              style={{ width: i === lines - 1 ? '60%' : '100%' }}
            />
          ))}
        </div>
      );
  }
}

export default Skeleton;

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} type="card" />
        ))}
      </div>
      <Skeleton type="table" lines={5} />
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} type="card" />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} type="avatar" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return <Skeleton type="table" lines={rows} />;
}
