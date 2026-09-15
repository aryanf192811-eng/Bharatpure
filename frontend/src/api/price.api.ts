import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface PriceRecommendation {
  crop_type: string
  quality_score_band: 'PREMIUM' | 'STANDARD' | 'ECONOMY'
  destination_city: string
  commodity_price_paise: number
  recommended_low_paise: number
  recommended_high_paise: number
  premium_pct: number
  buyer_acceptance_prob: number
  data_source: string
  generated_at: string
}

export interface MarketRatePoint {
  date: string
  price_paise: number
  source: string
}

export interface PremiumCalculation {
  at_commodity_rate_paise: number
  at_recommended_rate_paise: number
  premium_paise: number
  premium_pct: number
}

export const priceApi = {
  recommendation: (params: { crop_type: string; quality_score: number; city: string }) =>
    client.get<ApiSuccess<PriceRecommendation>>('/api/price/recommendation', { params }).then((r) => r.data),

  marketRates: (params: { crop_type: string }) =>
    client.get<ApiSuccess<{ history: MarketRatePoint[] }>>('/api/price/market-rates', { params }).then((r) => r.data),

  premiumCalculator: (params: { quality_score: number; crop_type: string; quantity_kg: number; destination_city: string }) =>
    client.get<ApiSuccess<PremiumCalculation>>('/api/price/premium-calculator', { params }).then((r) => r.data),
}
