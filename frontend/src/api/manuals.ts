import apiClient, { unwrap } from './client';

export interface Manual {
  id: string;
  title: string;
  description?: string;
  level: number;
  price: number;
  file_url?: string;
  cover_image_url?: string;
  course_id?: string;
  session_id?: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ManualPurchase {
  id: string;
  manual_id: string;
  manual_title: string;
  manual_level: number;
  course_code?: string;
  course_title?: string;
  price: number;
  is_collected: boolean;
  collected_at?: string;
  purchased_at: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

export interface PracticalEnrollment {
  id: string;
  student_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  enrolled_via: string;
  enrolled_at: string;
}

export const getManuals = async (params?: { level?: number }) => {
  const res = await apiClient.get('/manuals', { params });
  return unwrap<Manual[]>(res);
};

export const getManual = async (manualId: string) => {
  const res = await apiClient.get(`/manuals/${manualId}`);
  return unwrap<Manual>(res);
};

export const createManual = async (payload: {
  title: string;
  description?: string;
  level: number;
  price: number;
  course_id?: string;
  file_url?: string;
  cover_image_url?: string;
}) => {
  const res = await apiClient.post('/manuals', payload);
  return unwrap<Manual>(res);
};

export const updateManual = async (manualId: string, payload: Partial<Manual>) => {
  const res = await apiClient.put(`/manuals/${manualId}`, payload);
  return unwrap<Manual>(res);
};

export const deleteManual = async (manualId: string) => {
  await apiClient.delete(`/manuals/${manualId}`);
};

// Student purchase — requires a completed payment first for priced manuals
// (see checkoutManual below); safe to call directly for free manuals.
export const purchaseManual = async (manualId: string, paymentId?: string) => {
  const res = await apiClient.post('/manuals/purchase', { manual_id: manualId, payment_id: paymentId });
  return res.data;
};

// Student: initialize a Paystack checkout for a priced manual. Redirect the
// browser to the returned authorization_url; Paystack sends the student back
// to /payments/confirmation?manual_id=...&reference=... afterward.
export const checkoutManual = async (manualId: string, email: string) => {
  const res = await apiClient.post(`/manuals/${manualId}/checkout`, { email });
  return unwrap<{ authorization_url: string; reference: string; payment_id: string }>(res);
};

// Student my purchases
export const getMyPurchases = async () => {
  const res = await apiClient.get('/manuals/my-purchases');
  return unwrap<ManualPurchase[]>(res);
};

// Student download cover PDF (admin/print-collection use — carries a QR code)
export const downloadCover = async (purchaseId: string) => {
  const res = await apiClient.get(`/manuals/${purchaseId}/cover`, { responseType: 'blob' });
  return res.data;
};

// Student download proof-of-purchase receipt (no QR code)
export const downloadReceipt = async (purchaseId: string) => {
  const res = await apiClient.get(`/manuals/purchases/${purchaseId}/receipt`, { responseType: 'blob' });
  return res.data;
};

// Admin: bulk download every purchaser's cover for a manual as one combined PDF
export const bulkDownloadCovers = async (manualId: string) => {
  const res = await apiClient.get(`/manuals/${manualId}/covers/bulk`, { responseType: 'blob' });
  return res.data;
};

// QR verify
export const verifyManualQR = async (qrData: string) => {
  const res = await apiClient.post('/manuals/qr-verify', { qr_data: qrData });
  return res.data;
};

// Practical enrollments
export const getMyPracticalEnrollments = async () => {
  const res = await apiClient.get('/manuals/practicals');
  return unwrap<PracticalEnrollment[]>(res);
};

export interface ManualAdminPurchase {
  id: string;
  student_name?: string;
  matric_number?: string;
  manual_title?: string;
  price: number;
  is_collected: boolean;
  collected_at?: string;
  purchased_at: string;
}

// Admin: purchases by manual
export const getManualPurchases = async (manualId: string) => {
  const res = await apiClient.get(`/manuals/${manualId}/purchases`);
  return unwrap<ManualAdminPurchase[]>(res);
};

// Admin: mark collected
export const markManualCollected = async (purchaseId: string) => {
  const res = await apiClient.post(`/manuals/purchases/${purchaseId}/collect`);
  return res.data;
};
