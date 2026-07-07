import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { Search, CheckCircle, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface TransactionAudit {
  reference: string;
  studentName: string;
  purpose: string;
  amount: number;
  status: string;
  date: string;
}

const mockAudits: TransactionAudit[] = [
  { reference: 'PAYSTACK-REF-001', studentName: 'John Doe', purpose: 'Department Dues', amount: 15000, status: 'completed', date: '2026-06-20' },
];

const VerifyPaymentsPage = () => {
  const { success, warning } = useNotification();
  const [refInput, setRefInput] = useState('');
  const [searchedRecord, setSearchedRecord] = useState<TransactionAudit | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = () => {
    if (!refInput) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate search results
      if (refInput.toUpperCase().includes('WARN')) {
        warning('Pending Status', 'This transaction reference is currently pending verification.');
        setSearchedRecord({
          reference: refInput.toUpperCase(),
          studentName: 'Bob Alabi',
          purpose: 'Class Dues',
          amount: 5000,
          status: 'pending',
          date: '2026-06-21',
        });
      } else {
        success('Record Found', 'Transaction verified as Completed.');
        setSearchedRecord({
          reference: refInput.toUpperCase(),
          studentName: 'Jane Smith',
          purpose: 'Department Dues',
          amount: 15000,
          status: 'completed',
          date: '2026-06-20',
        });
      }
    }, 1000);
  };

  const handleApproveManually = () => {
    if (searchedRecord) {
      setSearchedRecord({ ...searchedRecord, status: 'completed' });
      success('Manually Approved', `Reference ${searchedRecord.reference} has been approved manually.`);
    }
  };

  const columns = [
    { key: 'reference', label: 'Reference Code' },
    { key: 'studentName', label: 'Student' },
    { key: 'purpose', label: 'Dues Type' },
    { key: 'amount', label: 'Amount', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Verify Payments</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Validate payment references, confirm Paystack transaction IDs, and clear registration holds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reference Audit</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. PAYSTACK-REF-01"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                />
                <Button isLoading={loading} onClick={handleSearch} leftIcon={<Search className="w-4 h-4" />}>
                  Verify
                </Button>
              </div>
            </div>
          </Card>

          {searchedRecord && (
            <Card className="border border-primary-500/20 bg-primary-500/5">
              <CardHeader>
                <CardTitle>Verification Detail</CardTitle>
              </CardHeader>
              <div className="p-4 pt-0 space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-surface-500">Student</span><span className="font-semibold">{searchedRecord.studentName}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Purpose</span><span className="font-semibold">{searchedRecord.purpose}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Amount</span><span className="font-semibold">{formatCurrency(searchedRecord.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Status</span><StatusBadge status={searchedRecord.status} /></div>
                </div>
                {searchedRecord.status === 'pending' && (
                  <Button className="w-full" leftIcon={<CheckCircle className="w-4 h-4" />} onClick={handleApproveManually}>
                    Approve Payment Manually
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Verifications</CardTitle>
            </CardHeader>
            <DataTable columns={columns} data={mockAudits as unknown as Record<string, unknown>[]} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VerifyPaymentsPage;
