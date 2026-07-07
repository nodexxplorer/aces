import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import DataTable from '../../components/data-display/DataTable';
import StatusBadge from '../../components/data-display/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useNotification } from '../../hooks/useNotification';
import { initializePaystackPayment, generatePaymentReference } from '../../utils/paystack';
import { CreditCard, Download } from 'lucide-react';
import type { Payment } from '../../types';

const mockPayments: Payment[] = [
  {
    id: 'pay-1',
    userId: 'stud-1',
    amount: 15000,
    currency: 'NGN',
    purpose: 'Department Dues',
    reference: 'ACES-2026-001',
    status: 'completed',
    method: 'paystack',
    createdAt: '2026-02-10T11:00:00Z',
  },
  {
    id: 'pay-2',
    userId: 'stud-1',
    amount: 5000,
    currency: 'NGN',
    purpose: 'Class Dues',
    reference: 'ACES-2026-002',
    status: 'pending',
    method: 'paystack',
    createdAt: '2026-06-20T10:00:00Z',
  },
];

const PaymentsPage = () => {
  const { success, error } = useNotification();
  const [payments, setPayments] = useState<Payment[]>(mockPayments);

  const handlePay = async (paymentId: string, amount: number, purpose: string) => {
    try {
      const reference = generatePaymentReference();
      const config = {
        publicKey: 'pk_test_xxxxxxxxxxxxx',
        amount,
        currency: 'NGN',
        reference,
        email: 'student@aces.com',
        callbackUrl: window.location.href,
      };

      const result = await initializePaystackPayment(config);
      success('Payment Initialized', `Redirecting to Paystack checkout for ${purpose}...`);
      
      // Simulate successful return
      setTimeout(() => {
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? { ...p, status: 'completed' as const, reference } : p))
        );
        success('Payment Successful', `Cleared outstanding dues for ${purpose}.`);
      }, 3000);

      window.open(result.paymentUrl, '_blank');
    } catch {
      error('Checkout Error', 'Unable to initiate gateway transaction.');
    }
  };

  const columns = [
    { key: 'purpose', label: 'Payment Purpose', sortable: true },
    { key: 'amount', label: 'Amount', render: (val: unknown) => formatCurrency(val as number) },
    { key: 'reference', label: 'Reference' },
    { key: 'createdAt', label: 'Date', render: (val: unknown) => formatDate(val as string) },
    { key: 'status', label: 'Status', render: (val: unknown) => <StatusBadge status={val as string} /> },
    {
      key: 'action',
      label: 'Action',
      render: (_: unknown, row: Payment) =>
        row.status === 'completed' ? (
          <Button variant="outline" size="xs" leftIcon={<Download className="w-3.5 h-3.5" />}>
            Receipt
          </Button>
        ) : (
          <Button size="xs" leftIcon={<CreditCard className="w-3.5 h-3.5" />} onClick={() => handlePay(row.id, row.amount, row.purpose)}>
            Pay Now
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Payments & Dues</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Pay your department dues and class fees securely via Paystack gateway.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Transactions Log</CardTitle>
              <CardDescription>Records of all dues payments and transaction audits</CardDescription>
            </CardHeader>
            <DataTable columns={columns as any} data={payments as any} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-warning-200 bg-warning-500/5">
            <CardHeader>
              <CardTitle className="text-warning-800 dark:text-warning-400">Outstanding Dues</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0">
              <p className="text-sm text-warning-800 dark:text-warning-300 leading-relaxed mb-4">
                You have one outstanding Class Dues payment. Please clear this dues balance to ensure you can register courses for examinations.
              </p>
              <div className="flex justify-between items-center bg-white dark:bg-surface-800 p-3 rounded-lg border border-warning-200">
                <span className="text-sm font-semibold">Class Dues</span>
                <span className="text-lg font-bold text-primary-500">{formatCurrency(5000)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentsPage;
