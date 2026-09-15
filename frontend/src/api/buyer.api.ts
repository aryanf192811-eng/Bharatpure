import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface BuyerDashboard {
  active_orders: number
  total_spent_paise: number
  escrow_held_paise: number
  reliability_score: number | null
}

export interface ReliabilitySnapshot {
  payment_reliability: string
  order_accuracy: string
  cancellation_rate: string
  dispute_rate: string
  computed_score: string
  computed_at: string
}

export interface BuyerReliability {
  latest: ReliabilitySnapshot
  history: ReliabilitySnapshot[]
}

export const buyerApi = {
  profile: () => client.get<ApiSuccess<Record<string, unknown>>>('/api/buyers/profile').then((r) => r.data),

  dashboard: () => client.get<ApiSuccess<BuyerDashboard>>('/api/buyers/dashboard').then((r) => r.data),

  reliability: () => client.get<ApiSuccess<BuyerReliability>>('/api/buyers/reliability').then((r) => r.data),
}
