import apiClient from './client';
import type { AlumniStatus, MentorshipRequest, JobPost, JobApplication, AlumniEvent, EventAttendee } from '../types';

// --- Alumni Status ---
export const getMyAlumniStatus = async () => {
  const { data } = await apiClient.get<{ data: AlumniStatus }>('/alumni/status/my');
  return data.data;
};

export const getAllAlumni = async (params?: { industry?: string; isMentor?: boolean; search?: string }) => {
  const { data } = await apiClient.get<{ data: AlumniStatus[] }>('/alumni', { params });
  return data.data;
};

export const verifyAlumni = async (alumniStatusId: string) => {
  const { data } = await apiClient.post<{ data: AlumniStatus }>(`/alumni/${alumniStatusId}/verify`);
  return data.data;
};

export const updateAlumniProfile = async (payload: Partial<AlumniStatus>) => {
  const { data } = await apiClient.put<{ data: AlumniStatus }>('/alumni/profile', payload);
  return data.data;
};

// --- Mentorship ---
export const getMentors = async () => {
  const { data } = await apiClient.get<{ data: AlumniStatus[] }>('/alumni/mentors');
  return data.data;
};

export const requestMentorship = async (alumniId: string, message: string) => {
  const { data } = await apiClient.post<{ data: MentorshipRequest }>('/alumni/mentorship/request', { alumniId, message });
  return data.data;
};

export const getMyMentorshipRequests = async () => {
  const { data } = await apiClient.get<{ data: MentorshipRequest[] }>('/alumni/mentorship/my');
  return data.data;
};

export const respondToMentorship = async (requestId: string, accept: boolean, response?: string) => {
  const { data } = await apiClient.post<{ data: MentorshipRequest }>(`/alumni/mentorship/${requestId}/respond`, { accept, response });
  return data.data;
};

// --- Jobs ---
export const getJobPosts = async (params?: { type?: string; search?: string }) => {
  const { data } = await apiClient.get<{ data: JobPost[] }>('/alumni/jobs', { params });
  return data.data;
};

export const createJobPost = async (payload: Omit<JobPost, 'id' | 'createdAt' | 'updatedAt' | 'postedBy' | 'poster' | 'viewCount' | 'applicationCount'>) => {
  const { data } = await apiClient.post<{ data: JobPost }>('/alumni/jobs', payload);
  return data.data;
};

export const applyToJob = async (jobId: string, payload: Pick<JobApplication, 'coverLetter' | 'resumeUrl'>) => {
  const { data } = await apiClient.post<{ data: JobApplication }>(`/alumni/jobs/${jobId}/apply`, payload);
  return data.data;
};

// --- Events ---
export const getAlumniEvents = async () => {
  const { data } = await apiClient.get<{ data: AlumniEvent[] }>('/alumni/events');
  return data.data;
};

export const registerForEvent = async (eventId: string) => {
  const { data } = await apiClient.post<{ data: EventAttendee }>(`/alumni/events/${eventId}/register`);
  return data.data;
};
