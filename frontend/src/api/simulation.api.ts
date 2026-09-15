import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'

export interface SimulationResult {
  input: { demand_spike_pct: number; supply_disruption_pct: number }
  shortage_kg: number
  recommended_actions: Array<Record<string, unknown> & { action: string }>
  farmer_realization_change_pct: number
  logistics_cost_change_pct: number
  run_duration_ms: number
}

export const simulationApi = {
  run: (payload: { crop_type: string; city: string; demand_spike_pct: number; supply_disruption_pct: number }) =>
    client.post<ApiSuccess<SimulationResult>>('/api/simulation/run', payload).then((r) => r.data),

  history: (params?: { page?: number; limit?: number }) =>
    client.get<ApiPaginated<SimulationResult>>('/api/simulation/history', { params }).then((r) => r.data),
}
