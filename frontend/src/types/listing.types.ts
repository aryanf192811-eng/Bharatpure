export interface Listing {
  id: string
  batch_id: string
  price_per_kg_paise: number
  min_order_kg: number
  max_order_kg: number | null
  listing_type: 'OPEN' | 'BULK_ONLY' | 'CONSUMER_ONLY'
  status: 'active' | 'paused' | 'sold_out' | 'cancelled'
  batch_code: string
  crop_type: string
  quality_score: number | null
  demand_forecast_kg?: number | null
  demand_confidence_pct?: number | null
}
