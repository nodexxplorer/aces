import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import api, { unwrap } from './client';

export interface VerifiedCourse {
  academic_year?: string;
  semester?: string;
  is_active?: boolean;
  id: string;
  code: string;
  title: string;
  semester_id: string;
  can_manage: boolean;
}
export interface VerifiedSession {
  id: string;
  title: string;
  venue: string;
  status: string;
  scheduled_at: string;
  delegate_id: string | null;
}
export interface VerifiedRecord {
  user_id: string;
  name: string;
  matric: string;
  outcome: string;
  verification: string;
  flags: string[];
  review_reason: string | null;
}
export interface VerifiedDetail {
  session: VerifiedSession;
  canManage: boolean;
  canOperate: boolean;
  records: VerifiedRecord[];
  disputes: {
    id: string;
    user_id: string;
    reason: string;
    status: string;
    resolution: string | null;
  }[];
}
export interface VerifiedEligibility {
  results: {
    user_id: string;
    credited: number;
    total: number;
    pending: number;
    percentage: number | null;
    decision: string;
  }[];
}
const root = '/verified-attendance';
export const verifiedCatalog = () => api.get(`${root}/catalog`).then(unwrap<{ courses: VerifiedCourse[] }>);
export const verifiedSessions = (c: VerifiedCourse) =>
  api
    .get(`${root}/sessions`, {
      params: { course: c.id, semester: c.semester_id },
    })
    .then(unwrap<VerifiedSession[]>);
export const verifiedDetail = (id: string) => api.get(`${root}/sessions/${id}`).then(unwrap<VerifiedDetail>);
export const verifiedEligibility = (c: VerifiedCourse) =>
  api.get(`${root}/courses/${c.id}/${c.semester_id}/eligibility`).then(unwrap<VerifiedEligibility>);
export const verifiedAction = (id: string, action: string, input: object = {}) =>
  api.post(`${root}/sessions/${id}/${action}`, input).then(unwrap);
export const verifiedCode = (id: string) =>
  api.get(`${root}/sessions/${id}/code`).then(unwrap<{ challenge: string; expiresAt: string }>);
export function parseVerifiedAttendanceQR(raw: string): { id: string; challenge: string } | null {
  try {
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !/\/attendance\/checkin$/.test(url.pathname) ||
      url.searchParams.get('v') !== '2'
    )
      return null;
    const id = url.searchParams.get('session');
    const challenge = new URLSearchParams(url.hash.slice(1)).get('challenge');
    return id && challenge ? { id, challenge } : null;
  } catch {
    return null;
  }
}
export async function verifiedCheckIn(id: string, challenge: string) {
  let device = await SecureStore.getItemAsync('aces-attendance-device-v1');
  if (!device) {
    device = Array.from(await Crypto.getRandomBytesAsync(32), (n) => n.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync('aces-attendance-device-v1', device);
  }
  let location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  } | null = null;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.granted) {
      // The one-shot request is bounded to leave time for the rotating code.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const p = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Location timeout')), 10000);
          }),
        ]);
        location = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy ?? 0,
          capturedAt: new Date(p.timestamp).toISOString(),
        };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  } catch {
    /* A technical failure is reviewable, never automatically absent. */
  }
  return api.post(`${root}/sessions/${id}/checkin`, { challenge, device, location }).then(unwrap<VerifiedRecord>);
}
