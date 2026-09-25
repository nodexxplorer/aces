import apiClient, { unwrap, getMediaUrl } from './client';

export type CRFSignatureKind = 'hod' | 'exam_officer';

// What the admin manages — just the signer's signature image. Where it lands
// on a student's form is decided by that student at signing time.
export interface CRFSignatureAsset {
  id: string;
  kind: CRFSignatureKind;
  file_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export const getCRFSignatureImageUrl = (filePath: string) =>
  getMediaUrl(`/uploads/${filePath.replace(/^\/+/, '')}`);

export interface CRFPlacement {
  page: number;
  x: number;
  y: number;
  width: number;
  max_height?: number;
  show_date?: boolean;
  date_x?: number | null;
  date_y?: number | null;
  date_font_size?: number;
}

export type CRFPlacements = Partial<Record<CRFSignatureKind, CRFPlacement>>;

export interface CRFSigningSubmission {
  id: string;
  user_id: string;
  semester_id: string;
  original_file_path: string;
  signed_file_path: string;
  placements: CRFPlacements;
  status: 'draft' | 'completed';
  created_at: string;
}

// ─── Admin: signature asset management ──────────────────────────────────────

export const listCRFSignatureAssets = async () => {
  const res = await apiClient.get('/crf-signatures');
  return (unwrap<CRFSignatureAsset[]>(res) ?? []) as CRFSignatureAsset[];
};

export const uploadCRFSignatureAsset = async (kind: CRFSignatureKind, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post(`/crf-signatures/${kind}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<CRFSignatureAsset>(res);
};

export const deleteCRFSignatureAsset = async (kind: CRFSignatureKind) => {
  await apiClient.delete(`/crf-signatures/${kind}`);
};

// ─── Student: upload → place → preview → approve ────────────────────────────

export const uploadCRF = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/crf-signing/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<CRFSigningSubmission>(res);
};

export const getMyCRFSubmission = async (): Promise<CRFSigningSubmission | null> => {
  const res = await apiClient.get('/crf-signing/mine');
  const body = res.data?.data ?? res.data;
  return (body ?? null) as CRFSigningSubmission | null;
};

export const listMyCRFDrafts = async () => {
  const res = await apiClient.get('/crf-signing/drafts');
  return (unwrap<CRFSigningSubmission[]>(res) ?? []) as CRFSigningSubmission[];
};

export const saveCRFPlacements = async (id: string, placements: CRFPlacements) => {
  const res = await apiClient.put(`/crf-signing/${id}/placements`, { placements });
  return unwrap<CRFSigningSubmission>(res);
};

// Server-rendered preview of exactly what the approved form will look like.
export const previewCRFSubmission = async (id: string): Promise<Blob> => {
  const res = await apiClient.post(`/crf-signing/${id}/preview`, {}, { responseType: 'blob' });
  return res.data as Blob;
};

export const approveCRFSubmission = async (id: string) => {
  const res = await apiClient.post(`/crf-signing/${id}/approve`);
  return unwrap<CRFSigningSubmission>(res);
};

export const getCRFDownloadUrl = (id: string) => {
  const base = apiClient.defaults.baseURL || '/api/v1';
  return `${base}/crf-signing/${id}/download`;
};

// Serves the student's stored ORIGINAL (unstamped) PDF for the placement
// canvas — drafts have no signed copy to download yet.
export const getCRFOriginalUrl = (id: string) => {
  const base = apiClient.defaults.baseURL || '/api/v1';
  return `${base}/crf-signing/${id}/original`;
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
