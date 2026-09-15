import { create } from 'zustand'

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

// Ephemeral, in-memory wizard state shared across the 3 batch-create routes (Step 1/2/3 are
// separate pages, not a single-page stepper) -- per BHARATPURE-UI.md, "data persists across
// steps (React state, not API calls)". Reset once the wizard completes or is abandoned.
export const useBatchDraftStore = create<BatchDraftState>()((set) => ({
  ...initial,
  set: (fields) => set(fields),
  reset: () => set(initial),
}))
