import { create } from 'zustand';
import { getUnreadCounts } from '../api/connect';

interface UnreadState {
  totalUnreadMessages: number;
  refresh: () => Promise<void>;
  setCounts: (counts: Record<string, number>) => void;
  decrement: (by: number) => void;
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
  // Opening a chat marks its messages read immediately — this lets the tab
  // bar badge reflect that right away instead of waiting for the Connect
  // list to regain focus or the next poll/socket event.
  decrement: (by) => set((s) => ({ totalUnreadMessages: Math.max(0, s.totalUnreadMessages - by) })),
  clear: () => set({ totalUnreadMessages: 0 }),
}));
