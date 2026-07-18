import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { requestTranscript, getStudentTranscriptRequests } from '../../api/transcripts';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { FileText, Send } from 'lucide-react';
import type { TranscriptRequest } from '../../types';

const TranscriptsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [requests, setRequests] = useState<TranscriptRequest[]>([]);
  const [dest, setDest] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    getStudentTranscriptRequests(user.id)
      .then(setRequests)
      .catch(() => notifyError('Error', 'Failed to load transcript requests'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleRequestOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest) return;
    setSubmitting(true);
    try {
      await requestTranscript({ destination: dest });
      setDest('');
      success('Request Submitted', 'Official transcript request queued for processing.');
      if (user?.id) {
        getStudentTranscriptRequests(user.id).then(setRequests);
      }
    } catch {
      notifyError('Submission Failed', 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'destination', label: 'Recipient Institution' },
    { key: 'createdAt', label: 'Date Requested', render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Academic Transcripts</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Download unofficial transcripts immediately, or request official transcripts sent directly to institutions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Official Request History</CardTitle>
              <CardDescription>Track the dispatch status of institutional transcripts</CardDescription>
            </CardHeader>
            <DataTable columns={columns} data={requests as unknown as Record<string, unknown>[]} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-500" />
              Unofficial Transcript
            </h3>
            <p className="text-xs text-surface-500 mb-4 leading-relaxed">
              Generate and download an unofficial copy of your results transcript for personal reference or internship applications.
            </p>
            <Button className="w-full" onClick={() => notifyError('Info', 'Unofficial transcript generation requires results data.')} leftIcon={<FileText className="w-4 h-4" />}>
              Download Copy
            </Button>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request Official Copy</CardTitle>
              <CardDescription>Fee: ₦10,000 per destination</CardDescription>
            </CardHeader>
            <form onSubmit={handleRequestOfficial} className="p-4 pt-0 space-y-4">
              <Input
                label="Destination Institution & Address"
                placeholder="e.g. Stanford University Admissions..."
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Send className="w-4 h-4" />}>
                Submit Request
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TranscriptsPage;
