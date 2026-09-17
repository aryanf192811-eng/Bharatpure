import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface BatchDraftState {
  clusterId: string
  cropType: string
  harvestDate: string
  totalQuantityKg: string
  notes: string
  estimatedPurity: number
  storageMethod: string
  treatmentApplied: boolean
  treatmentDescription: string
  pesticideUse: 'None' | 'Standard' | 'Organic certified'
  set: (fields: Partial<Omit<BatchDraftState, 'set' | 'reset'>>) => void
  reset: () => void
}

const initial = {
  clusterId: '',
  cropType: '',
  harvestDate: '',
  totalQuantityKg: '',
  notes: '',
  estimatedPurity: 85,
  storageMethod: '',
  treatmentApplied: false,
  treatmentDescription: '',
  pesticideUse: 'None' as const,
}

// Wizard state shared across the 3 batch-create routes (Step 1/2/3 are separate pages, not a
// single-page stepper) -- per BHARATPURE-UI.md, "data persists across steps (React state, not
// API calls)". Persisted to sessionStorage (not localStorage) so an accidental refresh mid-wizard
// doesn't lose the draft, while an abandoned draft still doesn't linger past the browser tab
// closing. reset() clears it once the wizard completes or is explicitly abandoned.
export const useBatchDraftStore = create<BatchDraftState>()(
  persist(
    (set) => ({
      ...initial,
      set: (fields) => set(fields),
      reset: () => set(initial),
    }),
    { name: 'bharatpure-batch-draft', storage: createJSONStorage(() => sessionStorage) },
  ),
)
