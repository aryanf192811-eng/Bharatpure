import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface DemandForecastRow {
  crop_type: string
  city: string
  forecast_date: string
  predicted_kg: number
  confidence_pct: number
  range_low_kg: number
  range_high_kg: number
  demand_drivers: { factor: string; contribution_pct: number }[]
  generated_at: string
}

export interface DemandForecastResponse {
  forecast: DemandForecastRow[]
  stale: boolean
}

export interface MultiCityDemand {
  [city: string]: { data: DemandForecastRow[]; stale?: boolean; unavailable?: boolean; reason?: string }
}

export const demandApi = {
  forecast: (params: { crop_type: string; city: string; days?: number }) =>
    client.get<ApiSuccess<DemandForecastResponse>>('/api/demand/forecast', { params }).then((r) => r.data),

  multiCity: (params: { crop_type: string; cities: string }) =>
    client.get<ApiSuccess<MultiCityDemand>>('/api/demand/multi-city', { params }).then((r) => r.data),
}
