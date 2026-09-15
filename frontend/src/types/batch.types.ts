export type BatchStatus =
  | 'draft'
  | 'pending_test'
  | 'test_passed'
  | 'test_failed'
  | 'listed'
  | 'partially_sold'
  | 'sold'
  | 'dispatched'
  | 'delivered'
  | 'rejected_post_delivery'

export interface BirEvent {
  event_type: string
  event_data: Record<string, unknown>
  created_at: string
  actor_role?: string
}

export interface Batch {
  id: string
  batch_code: string
  crop_type: string
  harvest_date: string
  total_quantity_kg: string
  remaining_quantity_kg: string
  quality_score: string | null
  status: BatchStatus
  qr_hash: string
  qr_burned_at: string | null
  created_at: string
  bir_events?: BirEvent[]
}
