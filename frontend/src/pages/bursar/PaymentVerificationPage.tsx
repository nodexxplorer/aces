import { useState } from 'react';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getPaymentByReference, verifyPayment } from '../../api/payments';
import { Search, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Payment } from '../../types';

const PaymentVerificationPage = () => {
  const { user } = useAuth();
  const { success, error: notifyError } = useNotification();
  const [refInput, setRefInput] = useState('');
  const [searchedRecord, setSearchedRecord] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [recentVerifications, setRecentVerifications] = useState<Payment[]>([]);

  const handleSearch = async () => {
    if (!refInput.trim()) return;
    try {
      setLoading(true);
      setSearchedRecord(null);
      const payment = await getPaymentByReference(refInput.trim());
      setSearchedRecord(payment);
      success('Record Found', `Payment by ${payment.student_name} found.`);
    } catch {
      notifyError('Not Found', `No payment found for reference "${refInput}".`);
      setSearchedRecord(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveManually = async () => {
    if (!searchedRecord || !user?.id) return;
    try {
      setVerifying(true);
      const updated = await verifyPayment(searchedRecord.id, user.id);
      setSearchedRecord(updated);
      setRecentVerifications((prev) => [updated, ...prev]);
      success('Manually Approved', `Payment ${searchedRecord.paystack_reference || searchedRecord.id} has been approved.`);
    } catch (err: any) {
      notifyError('Approval Failed', err?.response?.data?.error || 'Could not verify payment');
    } finally {
      setVerifying(false);
    }
  };

  const columns = [
    { key: 'paystack_reference', label: 'Reference' },
    { key: 'student_name', label: 'Student' },
    { key: 'item_name', label: 'Purpose' },
    { key: 'amount', label: 'Amount', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    { key: 'created_at', label: 'Date', render: (val: unknown) => val ? new Date(val as string).toLocaleDateString() : '—' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Verify Payments</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Search by Paystack reference, confirm transaction, and approve manually if needed.
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
                <input
                  className="flex-1 px-3 py-2 border rounded-lg dark:bg-surface-800 dark:border-surface-600 text-sm"
                  placeholder="e.g. ACES-abc12345-1234567890"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  {loading ? '...' : <Search className="w-4 h-4" />}
                </button>
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
                  <div className="flex justify-between"><span className="text-surface-500">Student</span><span className="font-semibold">{searchedRecord.student_name}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Matric No</span><span className="font-semibold">{searchedRecord.matric_number}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Purpose</span><span className="font-semibold">{searchedRecord.item_name}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Amount</span><span className="font-semibold">{formatCurrency(searchedRecord.amount)}</span></div>
                  <div className="flex justify-between"><span className="text-surface-500">Status</span><StatusBadge status={searchedRecord.status} /></div>
                </div>
                {searchedRecord.status === 'pending' && (
                  <button
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-600 text-sm font-medium disabled:opacity-50"
                    onClick={handleApproveManually}
                    disabled={verifying}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {verifying ? 'Approving...' : 'Approve Payment Manually'}
                  </button>
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
            <DataTable columns={columns} data={recentVerifications as unknown as Record<string, unknown>[]} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentVerificationPage;
