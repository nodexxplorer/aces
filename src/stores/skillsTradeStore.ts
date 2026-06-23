import { create } from 'zustand';
import type { SkillListing, TradeOffer, SkillCategory, UserReputation } from '../types';

interface SkillsTradeState {
  categories: SkillCategory[];
  listings: SkillListing[];
  myListings: SkillListing[];
  trades: TradeOffer[];
  myTrades: TradeOffer[];
  reputation: UserReputation | null;
  setCategories: (categories: SkillCategory[]) => void;
  setListings: (listings: SkillListing[]) => void;
  setMyListings: (listings: SkillListing[]) => void;
  setTrades: (trades: TradeOffer[]) => void;
  setMyTrades: (trades: TradeOffer[]) => void;
  setReputation: (reputation: UserReputation) => void;
  addListing: (listing: SkillListing) => void;
  updateListing: (id: string, partial: Partial<SkillListing>) => void;
  removeListing: (id: string) => void;
}

export const useSkillsTradeStore = create<SkillsTradeState>()((set) => ({
  categories: [],
  listings: [],
  myListings: [],
  trades: [],
  myTrades: [],
  reputation: null,
  setCategories: (categories) => set({ categories }),
  setListings: (listings) => set({ listings }),
  setMyListings: (myListings) => set({ myListings }),
  setTrades: (trades) => set({ trades }),
  setMyTrades: (myTrades) => set({ myTrades }),
  setReputation: (reputation) => set({ reputation }),
  addListing: (listing) =>
    set((state) => ({ myListings: [listing, ...state.myListings] })),
  updateListing: (id, partial) =>
    set((state) => ({
      myListings: state.myListings.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    })),
  removeListing: (id) =>
    set((state) => ({
      myListings: state.myListings.filter((l) => l.id !== id),
    })),
}));
