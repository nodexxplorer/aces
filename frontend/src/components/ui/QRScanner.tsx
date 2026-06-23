const QRScanner = ({ onScan }: { onScan: (data: string) => void }) => (
  <div className="flex flex-col items-center gap-4 p-6">
    <div id="qr-reader" className="w-64 h-64 rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600 flex items-center justify-center bg-surface-50 dark:bg-surface-800">
      <p className="text-sm text-surface-400 text-center px-4">Camera QR scanner will appear here when the device camera is available</p>
    </div>
    <button onClick={() => onScan('{"type":"manual","id":"demo-123"}')} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
      Simulate QR Scan
    </button>
  </div>
);

export default QRScanner;
