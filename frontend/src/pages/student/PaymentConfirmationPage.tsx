import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { CheckCircle, Clock, XCircle, ArrowLeft } from 'lucide-react';
import { confirmMyPaymentByReference } from '../../api/payments';
import type { Payment } from '../../types';

const PaymentConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        const data = await confirmMyPaymentByReference(reference);
        setPayment(data);
        if (data?.status === 'completed') {
          setStatus('success');
        } else if (data?.status === 'pending') {
          setStatus('pending');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    verify();
  }, [reference]);

  const icons = {
    loading: null,
    success: <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />,
    pending: <Clock className="w-16 h-16 text-yellow-500 mx-auto" />,
    error: <XCircle className="w-16 h-16 text-red-500 mx-auto" />,
  };

  const messages = {
    loading: 'Verifying your payment...',
    success: 'Payment Successful!',
    pending: 'Payment Pending',
    error: 'Payment Not Found',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === 'loading' ? (
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-surface-200 rounded-full mx-auto mb-4" />
            <p className="text-surface-500">{messages[status]}</p>
          </div>
        ) : (
          <>
            <div className="mb-6">{icons[status]}</div>
            <h1 className="text-2xl font-bold mb-2">{messages[status]}</h1>
            {reference && <p className="text-surface-500 text-sm mb-2">Reference: {reference}</p>}
            {payment && (
              <div className="text-sm text-surface-600 mb-6 space-y-1">
                <p>Item: {payment.item_name}</p>
                <p>Amount: {payment.amount}</p>
                <p>Status: {payment.status}</p>
              </div>
            )}
            <Link to="/payments">
              <Button className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Payments
              </Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  );
};

export default PaymentConfirmationPage;
