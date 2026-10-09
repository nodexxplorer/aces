import apiClient, { unwrap } from './client';
import type { AuthTokens, AuthUser } from '../store/authStore';

export const getMe = async () => {
  const res = await apiClient.get('/auth/me');
  return unwrap<AuthUser>(res);
};

export const logoutRequest = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // best-effort — local token wipe happens regardless
  }
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
};

export interface OnboardingPayload {
  phone: string;
  matricNumber: string;
  level?: number;
  middleName?: string;
  dateOfBirth: string; // YYYY-MM-DD
  admissionMode: 'UTME' | 'Direct Entry';
  yearAdmitted: string;
  emergencyContact: string;
  emergencyContactPhone: string;
  homeAddress?: string;
  profilePhotoUrl?: string;
}

export const submitOnboarding = async (payload: OnboardingPayload) => {
  await apiClient.post('/auth/onboarding', {
    matric_number: payload.matricNumber.trim().toUpperCase(),
    ...(payload.level ? { level: payload.level } : {}),
    phone: payload.phone,
    bio: '',
    avatar: payload.profilePhotoUrl || '',
    middle_name: payload.middleName || '',
    date_of_birth: payload.dateOfBirth,
    admission_mode: payload.admissionMode,
    year_admitted: payload.yearAdmitted,
    emergency_contact: payload.emergencyContact,
    emergency_contact_phone: payload.emergencyContactPhone,
    home_address: payload.homeAddress || '',
    profile_photo_url: payload.profilePhotoUrl || '',
  });
};
