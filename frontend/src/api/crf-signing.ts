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
}

// ─── HOD/admin: signature asset management ─────────────────────────────────

export const listCRFSignatureAssets = async () => {
  const res = await apiClient.get('/crf-signatures');
  return unwrap<CRFSignatureAsset[]>(res);
};

export const uploadCRFSignatureAsset = async (kind: CRFSignatureKind, file: File, placement: CRFPlacement) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page_number', String(placement.page_number));
  formData.append('x_pt', String(placement.x_pt));
  formData.append('y_pt', String(placement.y_pt));
  formData.append('width_pt', String(placement.width_pt));

  const res = await apiClient.post(`/crf-signatures/${kind}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrap<CRFSignatureAsset>(res);
};

// Returns the stamped PDF as a Blob for inline preview/download — used to
// check calibration before it goes live for students.
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
