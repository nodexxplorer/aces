import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import {
  getLecturerPendingAttendanceReviews,
  reviewAttendanceSession,
  downloadAttendancePDF,
  type PendingAttendanceReview,
} from '../../api/attendance';

const LecturerAttendanceReviewPage = () => {
  const { success, error: notifyError } = useNotification();
  const [reviews, setReviews] = useState<PendingAttendanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await getLecturerPendingAttendanceReviews();
      setReviews(data.reviews || []);
    } catch {
      notifyError('Error', 'Failed to load pending attendance submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleReview = async (sessionId: string, action: 'approve' | 'request_changes' | 'reject') => {
    try {
      setActionLoading(sessionId);
      await reviewAttendanceSession(sessionId, action);
      success(
        'Review Submitted',
        action === 'approve'
          ? 'Attendance sheet approved successfully'
          : action === 'request_changes'
          ? 'Change request sent to Class Rep'
          : 'Attendance sheet rejected'
      );
      await fetchReviews();
    } catch {
      notifyError('Action Failed', 'Failed to update review status');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Lecturer Attendance Review</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review, approve, or request corrections for attendance sheets submitted by Class Representatives.
        </p>
      </div>

      {reviews.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">All Caught Up!</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            There are no pending attendance sheets requiring your review right now.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {reviews.map((r) => (
            <Card key={r.session_id} className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{r.course_code}</span>
                    <Badge variant="warning">{r.status.replace('_', ' ')}</Badge>
                  </div>
                  <h2 className="text-base font-semibold text-surface-900 dark:text-white mt-1">{r.course_title}</h2>
                  <p className="text-xs text-surface-500 mt-1">
                    Submitted by <strong className="text-surface-700 dark:text-surface-300">{r.class_rep_name}</strong> on {r.scheduled_date}
                  </p>
                  <div className="flex gap-4 mt-3 text-xs">
                    <span className="text-success-600 dark:text-success-400 font-medium">Present: {r.total_present}</span>
                    <span className="text-danger-600 dark:text-danger-400 font-medium">Absent: {r.total_absent}</span>
                    <span className="text-surface-500">Total: {r.total_present + r.total_absent}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    leftIcon={<FileText className="w-4 h-4" />}
                    onClick={() => downloadAttendancePDF(r.session_id)}
                  >
                    View PDF
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={actionLoading === r.session_id}
                    leftIcon={<XCircle className="w-4 h-4" />}
                    onClick={() => handleReview(r.session_id, 'reject')}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    isLoading={actionLoading === r.session_id}
                    leftIcon={<AlertCircle className="w-4 h-4" />}
                    onClick={() => handleReview(r.session_id, 'request_changes')}
                  >
                    Request Changes
                  </Button>
                  <Button
                    variant="primary"
                    isLoading={actionLoading === r.session_id}
                    leftIcon={<CheckCircle className="w-4 h-4" />}
                    onClick={() => handleReview(r.session_id, 'approve')}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LecturerAttendanceReviewPage;
