import { create } from 'zustand';
import type {
  AlumniFullProfile,
  AlumniMyStats,
  MentorshipRequestItem,
  MentorItem,
  JobPost,
  AlumniEventItem,
  AlumniDonation,
} from '../types';

interface AlumniState {
  status: AlumniFullProfile | null;
  myStats: AlumniMyStats | null;
  mentorshipRequests: MentorshipRequestItem[];
  mentors: MentorItem[];
  jobPosts: JobPost[];
  events: AlumniEventItem[];
  donations: AlumniDonation[];
  isEligible: boolean;
  setStatus: (status: AlumniFullProfile | null) => void;
  setMyStats: (stats: AlumniMyStats | null) => void;
  setMentorshipRequests: (requests: MentorshipRequestItem[]) => void;
  setMentors: (mentors: MentorItem[]) => void;
  setJobPosts: (posts: JobPost[]) => void;
  setEvents: (events: AlumniEventItem[]) => void;
  setDonations: (donations: AlumniDonation[]) => void;
  setEligible: (eligible: boolean) => void;
}

export const useAlumniStore = create<AlumniState>()((set) => ({
  status: null,
  myStats: null,
  mentorshipRequests: [],
  mentors: [],
  jobPosts: [],
  events: [],
  donations: [],
  isEligible: false,
  setStatus: (status) => set({ status }),
  setMyStats: (myStats) => set({ myStats }),
  setMentorshipRequests: (mentorshipRequests) => set({ mentorshipRequests }),
  setMentors: (mentors) => set({ mentors }),
  setJobPosts: (jobPosts) => set({ jobPosts }),
  setEvents: (events) => set({ events }),
  setDonations: (donations) => set({ donations }),
  setEligible: (isEligible) => set({ isEligible }),
}));
