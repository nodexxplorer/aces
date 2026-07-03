import { create } from 'zustand';
import type { AlumniStatus, MentorshipRequest, JobPost, AlumniEvent } from '../types';

interface AlumniState {
  status: AlumniStatus | null;
  mentorshipRequests: MentorshipRequest[];
  jobPosts: JobPost[];
  events: AlumniEvent[];
  isEligible: boolean;
  setStatus: (status: AlumniStatus | null) => void;
  setMentorshipRequests: (requests: MentorshipRequest[]) => void;
  setJobPosts: (posts: JobPost[]) => void;
  setEvents: (events: AlumniEvent[]) => void;
  setEligible: (eligible: boolean) => void;
}

export const useAlumniStore = create<AlumniState>()((set) => ({
  status: null,
  mentorshipRequests: [],
  jobPosts: [],
  events: [],
  isEligible: false,
  setStatus: (status) => set({ status }),
  setMentorshipRequests: (mentorshipRequests) => set({ mentorshipRequests }),
  setJobPosts: (jobPosts) => set({ jobPosts }),
  setEvents: (events) => set({ events }),
  setEligible: (isEligible) => set({ isEligible }),
}));
