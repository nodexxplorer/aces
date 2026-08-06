import { useState, useEffect } from 'react';
import { AlertTriangle, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getMyCarryovers, type CarryoverCourseDetailed } from '../../api/carryovers';

const CarryoverPage = () => {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [carryovers, setCarryovers] = useState<CarryoverCourseDetailed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getMyCarryovers(user.id)
      .then(setCarryovers)
      .catch(() => notifyError('Error', 'Failed to load carryover courses'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const outstanding = carryovers.filter((c) => !c.is_resolved);
  const resolved = carryovers.filter((c) => c.is_resolved);
  const totalOutstandingUnits = outstanding.reduce((sum, c) => sum + c.unit, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Carryover Courses</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Courses you failed and must retake, and how they affect your CGPA.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Outstanding</p>
          <p className="text-2xl font-bold text-danger-600 dark:text-danger-400 mt-1">{outstanding.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Resolved</p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400 mt-1">{resolved.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500 font-medium">Units to Retake</p>
          <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{totalOutstandingUnits}</p>
        </Card>
      </div>

      {carryovers.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-success-400 mb-2" />
            <p className="text-sm font-medium text-surface-600 dark:text-surface-300">No carryover courses</p>
            <p className="text-xs text-surface-400 dark:text-surface-500">You're clear — keep it up.</p>
          </div>
        </Card>
      ) : (
        <>
          {outstanding.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-danger-500" />
                  <CardTitle>Outstanding Carryovers</CardTitle>
                </div>
                <CardDescription>These weigh into your CGPA as an F until retaken and passed.</CardDescription>
              </CardHeader>
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {outstanding.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 dark:text-surface-100">{c.course_code}</p>
                      <p className="text-xs text-surface-500 truncate">
                        {c.course_title} · {c.unit} unit(s)
                      </p>
                      <p className="text-[10px] text-surface-400 mt-0.5">Originally taken: {c.original_session_name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={c.attempt_count >= c.max_attempts ? 'danger' : 'warning'}>
                        Attempt {c.attempt_count} of {c.max_attempts}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {resolved.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-success-500" />
                  <CardTitle>Resolved</CardTitle>
                </div>
                <CardDescription>Retaken and passed — no longer affecting your CGPA as a fail.</CardDescription>
              </CardHeader>
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {resolved.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900 dark:text-surface-100">{c.course_code}</p>
                      <p className="text-xs text-surface-500 truncate">{c.course_title}</p>
                    </div>
                    <Badge variant="success">Resolved</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CarryoverPage;
