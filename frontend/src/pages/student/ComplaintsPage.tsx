import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { submitComplaint, getAllComplaints } from '../../api/complaints';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { Send } from 'lucide-react';
import type { Complaint } from '../../types';

const ComplaintsPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [category, setCategory] = useState('Result Error');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAllComplaints()
      .then((res) => {
        const list = Array.isArray(res) ? res : ((res as { data?: Complaint[] } | undefined)?.data ?? []);
        setComplaints(list);
      })
      .catch(() => notifyError('Error', 'Failed to load complaints'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !desc) return;
    setSubmitting(true);
    try {
      await submitComplaint({
        subject: title,
        description: desc,
        category,
        priority: 'medium',
      });
      setTitle('');
      setDesc('');
      success('Ticket Opened', 'Your complaint ticket has been submitted to department administration.');
      if (user?.id) {
        getAllComplaints().then((res) => {
          const list = Array.isArray(res) ? res : ((res as { data?: Complaint[] } | undefined)?.data ?? []);
          setComplaints(list);
        });
      }
    } catch {
      notifyError('Failed', 'Unable to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'category', label: 'Category' },
    { key: 'subject', label: 'Subject', render: (val: unknown) => <span className="font-medium">{(val as string) || 'N/A'}</span> },
    { key: 'createdAt', label: 'Filed Date', render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : 'N/A' },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Complaints & Tickets</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Open and monitor support tickets for academic results, registration or transaction errors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Log</CardTitle>
              <CardDescription>Records of filed complaints and administrative replies</CardDescription>
            </CardHeader>
            <DataTable columns={columns} data={complaints as unknown as Record<string, unknown>[]} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Submit Complaint</CardTitle>
              <CardDescription>File a new ticket for support staff review</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
              <Select
                label="Category"
                options={[
                  { value: 'Result Error', label: 'Result Discrepancy' },
                  { value: 'Payment Issue', label: 'Payment gateway error' },
                  { value: 'Timetable Conflict', label: 'Timetable conflict' },
                  { value: 'Other', label: 'Other' },
                ]}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <Input
                label="Subject"
                placeholder="e.g. Grade discrepancy for CPE 511"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
                <textarea
                  placeholder="Provide precise details, including course codes, payment dates, or references..."
                  className="w-full h-32 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" isLoading={submitting} leftIcon={<Send className="w-4 h-4" />}>
                Submit Ticket
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ComplaintsPage;
