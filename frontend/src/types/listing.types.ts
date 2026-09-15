import type { BirEvent } from '@/types/batch.types'

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

// GET /api/listings/:listingId returns more than the list view -- batch/cluster/FPO detail and
// the full BIR event log inline (see listing.service.js's getListingById).
export interface ListingDetail extends Listing {
  harvest_date: string
  batch_status: string
  cluster_name: string
  state: string
  district: string
  fpo_name: string | null
  fpo_trust_score: string | null
  bir_events: BirEvent[]
}
