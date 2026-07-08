import { useEffect, useRef } from 'react';
import { initQRScanner } from '../../utils/qr-scanner';

const QRScanner = ({ onScan }: { onScan: (data: string) => void }) => {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const elementId = 'qr-reader';

  useEffect(() => {
    const scanner = initQRScanner(
      elementId,
      (decodedText) => onScan(decodedText),
      () => {}
    );
    scannerRef.current = scanner;
    scanner.start();

    return () => {
      scanner.stop();
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div
        id={elementId}
        className="w-64 h-64 rounded-xl border-2 border-dashed border-surface-300 dark:border-surface-600 overflow-hidden bg-surface-50 dark:bg-surface-800"
      />
    </div>
  );
};

export default QRScanner;
