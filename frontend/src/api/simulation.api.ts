import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'

export interface SimulationAction {
  action: string
  description: string
  adjustment_paise?: number
}

// The controller spreads the request params + AI/fallback output flat onto the response --
// there is no nested "input" wrapper, despite that being a natural-looking shape to assume.
export interface SimulationResult {
  id: string
  crop_type: string
  city: string
  demand_spike_pct: number
  supply_disruption_pct: number
  shortage_kg: number
  surplus_kg: number
  price_change_pct: number
  farmer_realization_change_pct: number
  logistics_cost_change_pct: number
  recommended_actions: SimulationAction[]
  data_source: string
  stale: boolean
  run_duration_ms: number
  created_at: string
}

// GET /api/simulation/history returns the raw simulation_runs rows (not the flattened shape
// above) -- output_results is the JSON blob produced by a run, not spread onto the row.
export interface SimulationRunRow {
  id: string
  run_by: string
  input_params: { crop_type: string; city: string; demand_spike_pct: number; supply_disruption_pct: number }
  output_results: Omit<SimulationResult, 'id' | 'crop_type' | 'city' | 'demand_spike_pct' | 'supply_disruption_pct' | 'run_duration_ms' | 'created_at'>
  run_duration_ms: number
  created_at: string
}

export const simulationApi = {
  run: (payload: { crop_type: string; city: string; demand_spike_pct: number; supply_disruption_pct: number }) =>
    client.post<ApiSuccess<SimulationResult>>('/api/simulation/run', payload).then((r) => r.data),

  history: (params?: { page?: number; limit?: number }) =>
    client.get<ApiPaginated<SimulationRunRow>>('/api/simulation/history', { params }).then((r) => r.data),
}
