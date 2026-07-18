import { useState } from 'react';
import { purchaseManual } from '../api/manuals';

export const useManualEnrollment = () => {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const enrollViaQR = async (manualId: string) => {
    setIsEnrolling(true);
    setEnrollmentStatus('idle');
    try {
      await purchaseManual(manualId);
      setEnrollmentStatus('success');
    } catch {
      setEnrollmentStatus('error');
    } finally {
      setIsEnrolling(false);
    }
  };

  return { isEnrolling, enrollmentStatus, enrollViaQR, setEnrollmentStatus };
};
