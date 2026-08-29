import { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import { CheckCircle, XCircle, AlertCircle, FileText, History, Download } from 'lucide-react';
import {
  getLecturerPendingAttendanceReviews,
  getLecturerAttendanceHistory,
  reviewAttendanceSession,
  downloadAttendancePDF,
  getAttendancePDFBlobUrl,
  type PendingAttendanceReview,
} from '../../api/attendance';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  approved: 'success',
  rejected: 'danger',
  changes_requested: 'warning',
  pending_lecturer_review: 'default',
  pending: 'default',
  submitted: 'default',
};

const LecturerAttendanceReviewPage = () => {
  const { success, error: notifyError } = useNotification();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [reviews, setReviews] = useState<PendingAttendanceReview[]>([]);
  const [history, setHistory] = useState<PendingAttendanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await getLecturerAttendanceHistory();
      setHistory(data.history || []);
      setHistoryLoaded(true);
    } catch {
      notifyError('Error', 'Failed to load attendance history');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    if (tab === 'history' && !historyLoaded) {
      fetchHistory();
    }
  }, [tab, historyLoaded]);

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
            : 'Attendance sheet rejected',
      );
      await fetchReviews();
      setHistoryLoaded(false);
    } catch {
      notifyError('Action Failed', 'Failed to update review status');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreviewPDF = async (sessionId: string) => {
    setPreviewSessionId(sessionId);
    setPreviewLoading(true);
    try {
      const url = await getAttendancePDFBlobUrl(sessionId);
      setPreviewUrl(url);
    } catch {
      notifyError('Preview Failed', 'Could not load the attendance PDF');
      setPreviewSessionId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewSessionId(null);
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

      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-800">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'pending'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          Pending ({reviews.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'history'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {tab === 'history' ? (
        historyLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : history.length === 0 ? (
          <Card className="p-8 text-center">
            <History className="w-12 h-12 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-surface-900 dark:text-white">No History Yet</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Attendance sheets you've reviewed will show up here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {history.map((r) => (
              <Card key={r.session_id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{r.course_code}</span>
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <h2 className="text-base font-semibold text-surface-900 dark:text-white mt-1">{r.course_title}</h2>
                    <p className="text-xs text-surface-500 mt-1">
                      Submitted by{' '}
                      <strong className="text-surface-700 dark:text-surface-300">{r.class_rep_name}</strong> on{' '}
                      {r.scheduled_date}
                    </p>
                    <div className="flex gap-4 mt-3 text-xs">
                      <span className="text-success-600 dark:text-success-400 font-medium">
                        Present: {r.total_present}
                      </span>
                      <span className="text-danger-600 dark:text-danger-400 font-medium">Absent: {r.total_absent}</span>
                      <span className="text-surface-500">Total: {r.total_present + r.total_absent}</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    isLoading={previewLoading && previewSessionId === r.session_id}
                    leftIcon={<FileText className="w-4 h-4" />}
                    onClick={() => handlePreviewPDF(r.session_id)}
                  >
                    View PDF
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : reviews.length === 0 ? (
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
                    Submitted by <strong className="text-surface-700 dark:text-surface-300">{r.class_rep_name}</strong>{' '}
                    on {r.scheduled_date}
                  </p>
                  <div className="flex gap-4 mt-3 text-xs">
                    <span className="text-success-600 dark:text-success-400 font-medium">
                      Present: {r.total_present}
                    </span>
                    <span className="text-danger-600 dark:text-danger-400 font-medium">Absent: {r.total_absent}</span>
                    <span className="text-surface-500">Total: {r.total_present + r.total_absent}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    isLoading={previewLoading && previewSessionId === r.session_id}
                    leftIcon={<FileText className="w-4 h-4" />}
                    onClick={() => handlePreviewPDF(r.session_id)}
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

      <Modal isOpen={!!previewSessionId} onClose={closePreview} title="Attendance Sheet Preview" size="full">
        {previewLoading ? (
          <div className="flex items-center justify-center h-[70vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : previewUrl ? (
          <div className="space-y-4">
            <iframe
              src={previewUrl}
              title="Attendance PDF Preview"
              className="w-full h-[70vh] rounded-lg border border-surface-200 dark:border-surface-700"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closePreview}>
                Close
              </Button>
              <Button
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => previewSessionId && downloadAttendancePDF(previewSessionId)}
              >
                Download
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default LecturerAttendanceReviewPage;
