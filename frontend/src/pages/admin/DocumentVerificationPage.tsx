import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { listPendingDocuments, verifyDocument, rejectDocument } from '../../api/profile-edit';
import { useNotification } from '../../hooks/useNotification';
import { FileText, CheckCircle, XCircle, Clock, Eye, AlertCircle } from 'lucide-react';

const DocumentVerificationPage = () => {
  const { success, error: notifyError } = useNotification();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadDocs = async () => {
    setLoading(true);
    try {
      const res = await listPendingDocuments();
      setDocuments(res.data || []);
      setTotal(res.total || 0);
    } catch {
      notifyError('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocs(); }, []);

  const handleVerify = async (docId: string) => {
    try {
      await verifyDocument(docId);
      success('Verified', 'Document verified successfully.');
      loadDocs();
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.error || 'Failed to verify.');
    }
  };

  const handleReject = async (docId: string) => {
    if (!rejectReason || rejectReason.length < 5) {
      notifyError('Error', 'Rejection reason must be at least 5 characters.');
      return;
    }
    try {
      await rejectDocument(docId, rejectReason);
      success('Rejected', 'Document rejected.');
      setRejectingId(null);
      setRejectReason('');
      loadDocs();
    } catch (err: any) {
      notifyError('Error', err?.response?.data?.error || 'Failed to reject.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Document Verification</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Review and verify student-submitted documents. {total} pending.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Documents</CardTitle>
          <CardDescription>Documents awaiting your review</CardDescription>
        </CardHeader>
        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Clock className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          )}
          {!loading && documents.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-sm text-surface-500">No pending documents.</p>
            </div>
          )}
          {!loading && documents.map((doc) => (
            <div key={doc.id} className="p-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-surface-400 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-surface-900 dark:text-white">{doc.file_name}</span>
                      <Badge variant="warning" className="text-[10px]">{doc.doc_type?.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {doc.student_name || 'Student'} | {doc.matric_number || ''}
                    </p>
                    <p className="text-[10px] text-surface-400 mt-0.5">
                      Uploaded: {doc.created_at ? new Date(doc.created_at).toLocaleString() : 'N/A'} | {(doc.file_size / 1024).toFixed(1)} KB
                    </p>
                    {doc.file_url && (
                      <a
                        href={doc.file_url.startsWith('http') ? doc.file_url : `/api/v1/files/${doc.file_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-500 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> View Document
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="xs" variant="success" onClick={() => handleVerify(doc.id)} leftIcon={<CheckCircle className="w-3.5 h-3.5" />}>
                    Verify
                  </Button>
                  <Button size="xs" variant="danger" onClick={() => setRejectingId(rejectingId === doc.id ? null : doc.id)} leftIcon={<XCircle className="w-3.5 h-3.5" />}>
                    Reject
                  </Button>
                </div>
              </div>
              {rejectingId === doc.id && (
                <div className="mt-3 ml-8 flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-surface-700 dark:text-surface-300 mb-1">
                      Rejection Reason
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600 text-sm"
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this document is being rejected..."
                    />
                  </div>
                  <Button size="xs" variant="danger" onClick={() => handleReject(doc.id)} disabled={rejectReason.length < 5}>
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DocumentVerificationPage;
