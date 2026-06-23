import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { generateTranscriptPDF, downloadBlob } from '../../utils/pdf';
import { useNotification } from '../../hooks/useNotification';
import { FileText, Download, Send } from 'lucide-react';
import type { TranscriptRequest } from '../../types';

const mockRequests: TranscriptRequest[] = [
  {
    id: 'req-1',
    studentId: 'stud-1',
    destination: 'MIT Registrar, Cambridge MA',
    status: 'processing',
    paymentStatus: 'paid',
    createdAt: '2026-06-15T09:00:00Z',
  },
];

const TranscriptsPage = () => {
  const { success, error } = useNotification();
  const [requests, setRequests] = useState<TranscriptRequest[]>(mockRequests);
  const [dest, setDest] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDownloadUnofficial = async () => {
    setIsDownloading(true);
    try {
      const blob = await generateTranscriptPDF('stud-1');
      downloadBlob(blob, 'unofficial_transcript.pdf');
      success('Download Successful', 'Unofficial transcript PDF downloaded.');
    } catch {
      error('Download Failed', 'Failed to generate transcript PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRequestOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest) return;
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const newReq: TranscriptRequest = {
        id: `req-${Date.now()}`,
        studentId: 'stud-1',
        destination: dest,
        status: 'pending',
        paymentStatus: 'paid',
        createdAt: new Date().toISOString(),
      };
      setRequests((prev) => [newReq, ...prev]);
      setDest('');
      success('Request Submitted', 'Official transcript request queued for processing.');
    } catch {
      error('Submission Failed', 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'destination', label: 'Recipient Institution' },
    { key: 'createdAt', label: 'Date Requested', render: (val: unknown) => new Date(val as string).toLocaleDateString() },
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
            <Button className="w-full" isLoading={isDownloading} onClick={handleDownloadUnofficial} leftIcon={<Download className="w-4 h-4" />}>
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
