import apiClient, { unwrap } from './client';

export type CRFSignatureKind = 'hod' | 'exam_officer';

export interface CRFSignatureAsset {
  id: string;
  kind: CRFSignatureKind;
  file_path: string;
  page_number: number;
  x_pt: number;
  y_pt: number;
  width_pt: number;
  max_height_pt: number;
  show_date: boolean;
  date_x_pt: number | null;
  date_y_pt: number | null;
  date_font_size: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface CRFSigningSubmission {
  id: string;
  user_id: string;
  semester_id: string;
  original_file_path: string;
  signed_file_path: string;
  status: string;
  created_at: string;
}

export interface CRFPlacement {
  page_number: number;
  x_pt: number;
  y_pt: number;
  width_pt: number;
  max_height_pt: number;
  show_date: boolean;
  date_x_pt: number | null;
  date_y_pt: number | null;
  date_font_size: number;
}

// ─── HOD/admin: signature asset management ─────────────────────────────────

export const listCRFSignatureAssets = async () => {
  const res = await apiClient.get('/crf-signatures');
  return unwrap<CRFSignatureAsset[]>(res);
};

export const uploadCRFSignatureAsset = async (kind: CRFSignatureKind, file: File | null, placement: CRFPlacement) => {
  const formData = new FormData();
  if (file) formData.append('file', file);
  formData.append('page_number', String(placement.page_number));
  formData.append('x_pt', String(placement.x_pt));
  formData.append('y_pt', String(placement.y_pt));
  formData.append('width_pt', String(placement.width_pt));
  formData.append('max_height_pt', String(placement.max_height_pt));
  formData.append('show_date', String(placement.show_date));
  if (placement.date_x_pt != null) formData.append('date_x_pt', String(placement.date_x_pt));
  if (placement.date_y_pt != null) formData.append('date_y_pt', String(placement.date_y_pt));
  formData.append('date_font_size', String(placement.date_font_size));

  const res = await apiClient.post(`/crf-signatures/${kind}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<CRFSignatureAsset>(res);
};

export const deleteCRFSignatureAsset = async (kind: CRFSignatureKind) => {
  await apiClient.delete(`/crf-signatures/${kind}`);
};

export const testStampCRF = async (file: File): Promise<Blob> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient.post('/crf-signatures/test-stamp', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
  });
  return res.data as Blob;
};

// ─── Student: upload + retrieve own CRF ─────────────────────────────────────

export const submitCRFForSigning = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient.post('/crf-signing/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<CRFSigningSubmission>(res);
};

export const getMyCRFSubmission = async () => {
  const res = await apiClient.get('/crf-signing/mine');
  const body = res.data?.data ?? res.data;
  return (body ?? null) as CRFSigningSubmission | null;
};

export const getCRFDownloadUrl = (id: string) => {
  const base = apiClient.defaults.baseURL || '/api/v1';
  return `${base}/crf-signing/${id}/download`;
};

// ─── CRF backlog: paid catch-up submissions for old/unsigned course forms ──

export interface CRFBacklogPrice {
  amount_per_backlog: number;
  updated_by: string | null;
  updated_at: string;
}

export interface CRFBacklogRequest {
  id: string;
  user_id: string;
  requested_count: number;
  amount: number;
  payment_id: string | null;
  status: 'pending_payment' | 'paid';
  forms_submitted: number;
  created_at: string;
  paid_at: string | null;
}

export const getCRFBacklogPrice = async () => {
  const res = await apiClient.get('/crf-backlog/price');
  return unwrap<CRFBacklogPrice>(res);
};

export const updateCRFBacklogPrice = async (amount: number) => {
  const res = await apiClient.put('/crf-backlog/price', { amount });
  return unwrap<CRFBacklogPrice>(res);
};

export const createCRFBacklogRequest = async (count: number) => {
  const res = await apiClient.post('/crf-backlog/request', { count });
  return unwrap<{ backlog_request: CRFBacklogRequest; payment: { id: string } }>(res);
};

export const getMyCRFBacklogStatus = async () => {
  const res = await apiClient.get('/crf-backlog/mine');
  const body = res.data?.data ?? res.data;
  return (body ?? null) as CRFBacklogRequest | null;
};

export const submitCRFBacklogForm = async (file: File, semesterId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('semester_id', semesterId);

  const res = await apiClient.post('/crf-backlog/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<CRFSigningSubmission>(res);
};
