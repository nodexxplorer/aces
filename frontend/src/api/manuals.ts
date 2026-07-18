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

export interface PrintQueueItem {
  id: string;
  purchase_id: string;
  student_id: string;
  manual_id: string;
  status: string;
  queued_at: string;
  printed_at?: string;
  collected_at?: string;
  manual_title: string;
  student_name: string;
  matric_number: string;
  processed_by?: string;
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

export const createManual = async (payload: { title: string; description?: string; level: number; price: number; course_id?: string; file_url?: string; cover_image_url?: string }) => {
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

// Student purchase
export const purchaseManual = async (manualId: string) => {
  const res = await apiClient.post('/manuals/purchase', { manual_id: manualId });
  return res.data;
};

// Student my purchases
export const getMyPurchases = async () => {
  const res = await apiClient.get('/manuals/my-purchases');
  return unwrap<ManualPurchase[]>(res);
};

// Student download cover PDF
export const downloadCover = async (purchaseId: string) => {
  const res = await apiClient.get(`/manuals/purchases/${purchaseId}/cover`, { responseType: 'blob' });
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

// Admin: print queue
export const getManualPrintQueue = async (status?: string) => {
  const res = await apiClient.get('/manuals/print-queue', { params: status ? { status } : {} });
  return unwrap<PrintQueueItem[]>(res);
};

export const addToPrintQueue = async (purchaseId: string) => {
  const res = await apiClient.post('/manuals/print-queue', { purchase_id: purchaseId });
  return res.data;
};

export const updatePrintQueueStatus = async (queueId: string, status: string) => {
  const res = await apiClient.put(`/manuals/print-queue/${queueId}`, { status });
  return res.data;
};

// Admin: purchases by manual
export const getManualPurchases = async (manualId: string) => {
  const res = await apiClient.get(`/manuals/${manualId}/purchases`);
  return unwrap<any[]>(res);
};

// Admin: mark collected
export const markManualCollected = async (purchaseId: string) => {
  const res = await apiClient.post(`/manuals/purchases/${purchaseId}/collect`);
  return res.data;
};
