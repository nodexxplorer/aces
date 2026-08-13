import { create } from 'zustand';
import { getUnreadCounts } from '../api/connect';

interface UnreadState {
  totalUnreadMessages: number;
  refresh: () => Promise<void>;
  setCounts: (counts: Record<string, number>) => void;
  clear: () => void;
}

// Backs the Connect tab's badge. The Connect screen itself fetches the
// full per-conversation breakdown it needs to render individual badges, so
// rather than duplicate that API call, it pushes its already-fetched counts
// in via setCounts — refresh() (a fresh fetch) is for the tab bar polling on
// its own, when Connect isn't the active screen.
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
  setCounts: (counts) => set({ totalUnreadMessages: Object.values(counts).reduce((sum, n) => sum + n, 0) }),
  clear: () => set({ totalUnreadMessages: 0 }),
}));
