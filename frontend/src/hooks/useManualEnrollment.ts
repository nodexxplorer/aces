import { useState } from 'react';

export const useManualEnrollment = () => {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const enrollViaQR = async (_qrData: string) => {
    setIsEnrolling(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setEnrollmentStatus('success');
    } catch {
      setEnrollmentStatus('error');
    } finally {
      setIsEnrolling(false);
    }
  };

  return { isEnrolling, enrollmentStatus, enrollViaQR, setEnrollmentStatus };
};
