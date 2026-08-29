import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import QRScanner from '../../components/ui/QRScanner';
import { useNotification } from '../../hooks/useNotification';
import { ScanLine, XCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseProfileScanUserId } from '../../utils/qr-scanner';

export default function QRScanPage() {
  const navigate = useNavigate();
  const { error: notifyError } = useNotification();
  const [scanning, setScanning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleScan = async (data: string) => {
    setScanning(false);

    const scannedUserId = parseProfileScanUserId(data);
    if (scannedUserId) {
      navigate(`/connect?scan=${scannedUserId}`);
      return;
    }

    const msg = 'Not a recognized profile QR code.';
    setLastError(msg);
    notifyError('Scan Failed', msg);
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
          <p className="text-sm text-surface-500 dark:text-surface-400">Scan a student's profile QR code to connect.</p>
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
                setLastError(null);
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

      {lastError && (
        <Card>
          <div className="p-4 flex items-start gap-3 bg-danger-50 dark:bg-danger-900/10 rounded-xl">
            <XCircle className="w-5 h-5 text-danger-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-danger-700 dark:text-danger-400">Failed</p>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">{lastError}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
