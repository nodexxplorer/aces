import apiClient, { unwrap } from './client';
import type {
  AlumniStatus,
  MentorshipRequest,
  JobPost,
  JobApplication,
  AlumniEvent,
  EventAttendee,
  AlumniProfile,
  AlumniFullProfile,
  AlumniDirectoryItem,
  AlumniDashboardStats,
  AlumniMyStats,
  MentorItem,
  MentorshipRequestItem,
  AlumniEventItem,
  AlumniDonation,
  DonationStats,
} from '../types';

export const getAlumniProfiles = async () => {
  const res = await apiClient.get('/alumni');
  return unwrap<AlumniProfile[]>(res);
};

export const createAlumniProfile = async (payload: Partial<AlumniProfile>) => {
  const res = await apiClient.post('/alumni/status', payload);
  return unwrap<AlumniProfile>(res);
};

// --- Alumni Status ---
export const getMyAlumniStatus = async () => {
  const res = await apiClient.get('/alumni/status/my');
  return unwrap<AlumniFullProfile>(res);
};

export const getAllAlumni = async (params?: { industry?: string; isMentor?: boolean; search?: string }) => {
  const res = await apiClient.get('/alumni', { params });
  return unwrap<AlumniStatus[]>(res);
};

export const verifyAlumni = async (alumniStatusId: string) => {
  const res = await apiClient.post(`/alumni/${alumniStatusId}/verify`);
  return unwrap<AlumniStatus>(res);
};

export const updateAlumniProfile = async (payload: Partial<AlumniStatus>) => {
  const res = await apiClient.put('/alumni/profile', payload);
  return unwrap<AlumniStatus>(res);
};

export const updateAlumniProfileFull = async (payload: {
  location?: string;
  portfolio_url?: string;
  bio?: string;
  linkedin_url?: string;
  is_mentor_available?: boolean;
  mentorship_topics?: string;
  skills?: string;
  willing_to_speak?: boolean;
  event_interests?: string;
  privacy_level?: string;
  industry?: string;
  job_title?: string;
  current_company?: string;
}) => {
  const res = await apiClient.put('/alumni/profile/full', payload);
  return unwrap<{ message: string }>(res);
};

// --- Dashboard Stats ---
export const getAlumniDashboardStats = async () => {
  const res = await apiClient.get('/alumni/dashboard/stats');
  return unwrap<AlumniDashboardStats>(res);
};

export const getAlumniMyStats = async () => {
  const res = await apiClient.get('/alumni/my-stats');
  return unwrap<AlumniMyStats>(res);
};

// --- Alumni Directory ---
export const searchAlumniDirectory = async (params?: {
  search?: string;
  year_from?: number;
  year_to?: number;
  industry?: string;
  location?: string;
  mentor_only?: boolean;
}) => {
  const res = await apiClient.get('/alumni/directory', { params });
  return unwrap<AlumniDirectoryItem[]>(res);
};

// --- Mentorship ---
export const getMentors = async () => {
  const res = await apiClient.get('/alumni/mentors');
  return unwrap<MentorItem[]>(res);
};

export const requestMentorship = async (mentorId: string, topic: string, message?: string) => {
  const res = await apiClient.post('/alumni/mentorship/requests', { mentor_id: mentorId, topic, message });
  return unwrap<MentorshipRequest>(res);
};

export const getMyMentorshipRequests = async () => {
  const res = await apiClient.get('/alumni/mentorship/my');
  return unwrap<MentorshipRequestItem[]>(res);
};

export const respondToMentorship = async (requestId: string, status: string) => {
  const res = await apiClient.put(`/alumni/mentorship/requests/${requestId}`, { status });
  return unwrap<MentorshipRequest>(res);
};

// --- Jobs ---
export const getJobPosts = async () => {
  const res = await apiClient.get('/alumni/jobs');
  return unwrap<JobPost[]>(res);
};

export const getJobPost = async (jobId: string) => {
  const res = await apiClient.get(`/alumni/jobs/${jobId}`);
  return unwrap<JobPost>(res);
};

export const createJobPost = async (payload: {
  title: string;
  company: string;
  location?: string;
  job_type: string;
  industry?: string;
  description: string;
  requirements?: string;
  responsibilities?: string;
  salary_range?: string;
  application_url?: string;
}) => {
  const res = await apiClient.post('/alumni/jobs', payload);
  return unwrap<JobPost>(res);
};

export const updateJobPost = async (
  jobId: string,
  payload: {
    title: string;
    company: string;
    location?: string;
    job_type: string;
    industry?: string;
    description: string;
    requirements?: string;
    responsibilities?: string;
    salary_range?: string;
    application_url?: string;
    application_deadline?: string;
  }
) => {
  const res = await apiClient.put(`/alumni/jobs/${jobId}`, payload);
  return unwrap<JobPost>(res);
};

export const listUserJobPosts = async (userId: string) => {
  const res = await apiClient.get(`/alumni/jobs/user/${userId}`);
  return unwrap<JobPost[]>(res);
};

export const applyToJob = async (jobId: string, payload: {
  cover_letter?: string;
  resume_url?: string;
}) => {
  const res = await apiClient.post(`/alumni/jobs/${jobId}/apply`, payload);
  return unwrap<JobApplication>(res);
};

export const listJobApplications = async (jobId: string) => {
  const res = await apiClient.get(`/alumni/jobs/${jobId}/applications`);
  return unwrap<JobApplication[]>(res);
};

export const updateJobApplicationStatus = async (applicationId: string, status: string) => {
  const res = await apiClient.put(`/alumni/jobs/applications/${applicationId}`, { status });
  return unwrap<JobApplication>(res);
};

export const listMyJobApplications = async () => {
  const res = await apiClient.get('/alumni/jobs/applications/mine');
  return unwrap<JobApplication[]>(res);
};

export const archiveJobPost = async (jobId: string) => {
  const res = await apiClient.delete(`/alumni/jobs/${jobId}`);
  return res.data;
};

export const trackJobView = async (jobId: string) => {
  const res = await apiClient.post(`/alumni/jobs/${jobId}/view`);
  return res.data;
};

// --- Events ---
export const getAlumniEvents = async () => {
  const res = await apiClient.get('/alumni/events');
  return unwrap<AlumniEventItem[]>(res);
};

export const registerForEvent = async (eventId: string) => {
  const res = await apiClient.post(`/alumni/events/${eventId}/register`);
  return unwrap<EventAttendee>(res);
};

export const getEventAttendees = async (eventId: string) => {
  const res = await apiClient.get(`/alumni/events/${eventId}/attendees`);
  return unwrap<EventAttendee[]>(res);
};

// --- Donations ---
export const createDonation = async (payload: {
  channel: string;
  amount: number;
  currency?: string;
  message?: string;
  is_anonymous?: boolean;
}) => {
  const res = await apiClient.post('/alumni/donations', payload);
  return res.data.data as { authorization_url: string; reference: string; access_code: string };
};

export const listDonations = async () => {
  const res = await apiClient.get('/alumni/donations');
  return unwrap<AlumniDonation[]>(res);
};

export const listMyDonations = async () => {
  const res = await apiClient.get('/alumni/donations/mine');
  return unwrap<AlumniDonation[]>(res);
};

export const getDonationStats = async () => {
  const res = await apiClient.get('/alumni/donations/stats');
  return unwrap<DonationStats>(res);
};
