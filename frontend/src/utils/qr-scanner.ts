import { Html5Qrcode } from 'html5-qrcode';

export const initQRScanner = (
  elementId: string,
  onScan: (decodedText: string) => void,
  onError?: (errorMessage: string) => void
): { start: () => Promise<void>; stop: () => Promise<void> } => {
  const html5QrCode = new Html5Qrcode(elementId);

  const start = async () => {
    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
        },
        (errorMessage) => {
          onError?.(errorMessage);
        }
      );
    } catch (err) {
      onError?.(`Camera error: ${err}`);
    }
  };

  const stop = async () => {
    try {
      await html5QrCode.stop();
    } catch {
      // ignore if already stopped
    }
  };

  return { start, stop };
};

export const parseQRData = (data: string): { type: string; id: string } | null => {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && 'id' in parsed) {
      return { type: parsed.type || 'manual', id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
};
