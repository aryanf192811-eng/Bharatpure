import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { CartItem } from '@/types/cart.types'

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (listingId: string) => void
  updateQuantity: (listingId: string, quantityKg: number) => void
  clearCart: () => void
  total: () => number
}

// Persisted to localStorage (same pattern as auth.store.ts) so a consumer's cart survives a
// refresh -- losing an in-progress cart on an accidental reload is a real checkout-abandonment
// risk, not just an inconvenience.
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.listingId === item.listingId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.listingId === item.listingId ? { ...i, quantityKg: i.quantityKg + item.quantityKg } : i,
              ),
            }
          }
          return { items: [...state.items, item] }
        }),

      removeItem: (listingId) =>
        set((state) => ({ items: state.items.filter((i) => i.listingId !== listingId) })),

      updateQuantity: (listingId, quantityKg) =>
        set((state) => ({
          items: state.items.map((i) => (i.listingId === listingId ? { ...i, quantityKg } : i)),
        })),

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, i) => sum + i.pricePerKgPaise * i.quantityKg, 0),
    }),
    { name: 'bharatpure-cart' },
  ),
)
