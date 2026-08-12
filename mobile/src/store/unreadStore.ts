import { create } from 'zustand';
import { getUnreadCounts } from '../api/connect';

interface UnreadState {
  totalUnreadMessages: number;
  refresh: () => Promise<void>;
  clear: () => void;
}

// Single source of truth for the Connect tab's badge — both the tab bar and
// the Connect screen itself read from this instead of each polling
// independently, so the badge and the in-screen counts can't drift apart.
export const useUnreadStore = create<UnreadState>((set) => ({
  totalUnreadMessages: 0,
  refresh: async () => {
    try {
      const counts = await getUnreadCounts();
      set({ totalUnreadMessages: Object.values(counts).reduce((sum, n) => sum + n, 0) });
    } catch {
      // leave the last known count on screen
    }
  },
  clear: () => set({ totalUnreadMessages: 0 }),
}));
