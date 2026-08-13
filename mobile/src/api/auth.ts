import apiClient, { unwrap } from './client';
import type { AuthTokens, AuthUser } from '../store/authStore';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    avatar?: string;
    role: string;
    activeRole: string;
    roles: string[];
    matricNumber?: string;
    level?: number;
    onboardingCompleted: boolean;
    phone?: string;
    homeAddress?: string;
    dateOfBirth?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    isApproved?: boolean;
    isActive?: boolean;
  };
  tokens: AuthTokens;
}

export const login = async (email: string, password: string) => {
  const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/login', { email, password });
  const { user, tokens } = data.data;
  const authUser: AuthUser = { ...user };
  return { user: authUser, tokens };
};

export interface StudentSignupPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  matricNumber: string;
  level: number;
  department?: string;
}

export const signupStudent = async (payload: StudentSignupPayload) => {
  const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/signup/student', payload);
  const { user, tokens } = data.data;
  const authUser: AuthUser = { ...user };
  return { user: authUser, tokens };
};

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
