import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import QRScanner from '../../components/ui/QRScanner';
import { verifyManualQR } from '../../api/manuals';
import { useNotification } from '../../hooks/useNotification';
import { ScanLine, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseProfileScanUserId } from '../../utils/qr-scanner';
import { getErrorMessage } from '../../utils/errors';

// The manuals QR-verify endpoint's response shape isn't declared in
// src/api/manuals.ts (it returns the raw axios `res.data`) — capture just
// the fields this page reads from it.
interface ManualQRVerifyResult {
  message?: string;
  student_name?: string;
}

export default function QRScanPage() {
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    data?: ManualQRVerifyResult;
  } | null>(null);

  const handleScan = async (data: string) => {
    setScanning(false);

    // A scanned student profile QR takes you straight to Connect instead of
    // being treated as a manual-purchase verification code.
    const scannedUserId = parseProfileScanUserId(data);
    if (scannedUserId) {
      navigate(`/connect?scan=${scannedUserId}`);
      return;
    }

    try {
      const result = (await verifyManualQR(data)) as ManualQRVerifyResult;
      setLastResult({ success: true, message: result.message || 'QR code verified successfully.', data: result });
      success('QR Verified', result.message || 'Manual QR code verified.');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Invalid QR code');
      setLastResult({ success: false, message: msg });
      notifyError('Verification Failed', msg);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-surface-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Scan QR Code</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Scan a manual QR code to verify or enroll.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Camera Scanner</CardTitle>
          <CardDescription>Point your camera at a QR code</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          {!scanning ? (
            <Button
              onClick={() => {
                setScanning(true);
                setLastResult(null);
              }}
              leftIcon={<ScanLine className="w-4 h-4" />}
            >
              Start Scanning
            </Button>
          ) : (
            <div className="space-y-3">
              <QRScanner onScan={handleScan} />
              <Button variant="outline" onClick={() => setScanning(false)} className="w-full">
                Stop Scanner
              </Button>
            </div>
          )}
        </div>
      </Card>

      {lastResult && (
        <Card>
          <div
            className={`p-4 flex items-start gap-3 ${lastResult.success ? 'bg-success-50 dark:bg-success-900/10' : 'bg-danger-50 dark:bg-danger-900/10'} rounded-xl`}
          >
            {lastResult.success ? (
              <CheckCircle className="w-5 h-5 text-success-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-danger-500 mt-0.5 shrink-0" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${lastResult.success ? 'text-success-700 dark:text-success-400' : 'text-danger-700 dark:text-danger-400'}`}
              >
                {lastResult.success ? 'Verified' : 'Failed'}
              </p>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{lastResult.message}</p>
              {lastResult.data?.student_name && (
                <p className="text-xs text-surface-500 mt-1">Student: {lastResult.data.student_name}</p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
