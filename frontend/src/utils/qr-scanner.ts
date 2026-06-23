export const initQRScanner = (elementId: string): { start: () => void; stop: () => void } => {
  return {
    start: () => console.log(`QR Scanner started on #${elementId}`),
    stop: () => console.log('QR Scanner stopped'),
  };
};

export const parseQRData = (data: string): { type: string; id: string } | null => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};
