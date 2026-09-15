import { create } from 'zustand'

import type { CartItem } from '@/types/cart.types'

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (listingId: string) => void
  updateQuantity: (listingId: string, quantityKg: number) => void
  clearCart: () => void
  total: () => number
}

// In-memory only, deliberately not persisted -- see BHARATPURE-CLAUDE.md state management rules.
export const useCartStore = create<CartState>()((set, get) => ({
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
}))
