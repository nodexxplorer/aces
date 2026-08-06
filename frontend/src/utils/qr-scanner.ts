import { Html5Qrcode } from 'html5-qrcode';

export const initQRScanner = (
  elementId: string,
  onScan: (decodedText: string) => void,
  onError?: (errorMessage: string) => void,
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
        },
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

export const PROFILE_SCAN_PARAM = 'scan';

// A student's profile QR encodes a plain URL (`${origin}/connect?scan=<userId>`) so
// that any stock phone camera app can open it directly, not just our in-app scanner.
// Falls back to the older raw-JSON payload for QR codes generated before this change.
export const parseProfileScanUserId = (data: string): string | null => {
  const text = data.trim();
  try {
    const url = new URL(text);
    const id = url.searchParams.get(PROFILE_SCAN_PARAM);
    if (id) return id;
  } catch {
    // not a URL, fall through to legacy format
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && typeof parsed.userId === 'string' && parsed.userId) {
      return parsed.userId;
    }
  } catch {
    // not JSON either
  }
  return null;
};
