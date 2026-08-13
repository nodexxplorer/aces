import apiClient, { unwrap } from './client';

export interface Manual {
  id: string;
  title: string;
  description?: string;
  level: number;
  price: number;
  cover_image_url?: string;
  is_active: boolean;
}

export interface ManualPurchase {
  id: string;
  manual_id: string;
  manual_title: string;
  manual_level: number;
  price: number;
  is_collected: boolean;
  purchased_at: string;
}

export const getManuals = async (params?: { level?: number }) => {
  const res = await apiClient.get('/manuals', { params });
  return unwrap<Manual[]>(res);
};

export const getMyPurchases = async () => {
  const res = await apiClient.get('/manuals/my-purchases');
  return unwrap<ManualPurchase[]>(res);
};

export interface QRVerifyResult {
  success: boolean;
  message?: string;
  error?: string;
}

export const verifyManualQR = async (qrData: string) => {
  const res = await apiClient.post('/manuals/qr-verify', { qr_data: qrData });
  return unwrap<QRVerifyResult>(res);
};
