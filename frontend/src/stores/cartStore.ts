import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Manual, ManualPurchase } from '../types';

interface CartItem {
  manual: Manual;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  purchases: ManualPurchase[];
  addItem: (manual: Manual) => void;
  removeItem: (manualId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  setPurchases: (purchases: ManualPurchase[]) => void;
  addPurchase: (purchase: ManualPurchase) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      purchases: [],
      addItem: (manual) =>
        set((state) => {
          const exists = state.items.find((i) => i.manual.id === manual.id);
          if (exists) return state;
          return { items: [...state.items, { manual, quantity: 1 }] };
        }),
      removeItem: (manualId) =>
        set((state) => ({
          items: state.items.filter((i) => i.manual.id !== manualId),
        })),
      clearCart: () => set({ items: [] }),
      getTotal: () => get().items.reduce((sum, i) => sum + i.manual.price * i.quantity, 0),
      getItemCount: () => get().items.length,
      setPurchases: (purchases) => set({ purchases }),
      addPurchase: (purchase) =>
        set((state) => ({ purchases: [purchase, ...state.purchases] })),
    }),
    { name: 'aces-cart' }
  )
);
