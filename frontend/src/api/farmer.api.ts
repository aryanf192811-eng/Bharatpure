import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface DemandSignal {
  crop_type: string
  city: string
  predicted_kg: number
  confidence_pct: number
  demand_delta_pct: number
}

export interface FarmerDashboard {
  active_batches: number
  pending_payments_paise: number
  total_earned_paise: number
  trust_score: number | null
  demand_signals: DemandSignal[]
  recent_batches: Array<{
    id: string
    batch_code: string
    crop_type: string
    status: string
    total_quantity_kg: string
    remaining_quantity_kg: string
    quality_score: string | null
    created_at: string
  }>
  active_contracts: number
}

export interface FarmerEarningsRow {
  batch_id: string
  batch_code: string
  crop_type: string
  status: string
  quantity_sold_kg: number
  total_paise: number
  avg_price_per_kg_paise: number
}

export interface FarmerTrustScore {
  computed_score: string
  fulfillment_rate: string
  quality_consistency: string
  on_time_delivery_rate: string
  dispute_rate: string
  buyer_rating_avg: string
  total_batches: number
  computed_at: string
}

export const farmerApi = {
  profile: () => client.get<ApiSuccess<Record<string, unknown>>>('/api/farmers/profile').then((r) => r.data),

  dashboard: () => client.get<ApiSuccess<FarmerDashboard>>('/api/farmers/dashboard').then((r) => r.data),

  earnings: (params?: { from?: string; to?: string }) =>
    client.get<ApiSuccess<FarmerEarningsRow[]>>('/api/farmers/earnings', { params }).then((r) => r.data),

  trustScore: () => client.get<ApiSuccess<FarmerTrustScore>>('/api/farmers/trust-score').then((r) => r.data),
}
