import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'
import type { Listing } from '@/types/listing.types'

export interface CreateListingPayload {
  batch_id: string
  price_per_kg_paise: number
  min_order_kg?: number
  max_order_kg?: number
  listing_type?: 'OPEN' | 'BULK_ONLY' | 'CONSUMER_ONLY'
  available_until?: string
}

export const listingApi = {
  list: (params?: { crop_type?: string; city?: string; min_quality?: number; page?: number; limit?: number; sort?: string }) =>
    client.get<ApiPaginated<Listing>>('/api/listings', { params }).then((r) => r.data),

  getById: (id: string) => client.get<ApiSuccess<Listing>>(`/api/listings/${id}`).then((r) => r.data),

  create: (payload: CreateListingPayload) =>
    client.post<ApiSuccess<Listing>>('/api/listings', payload).then((r) => r.data),

  update: (id: string, payload: { price_per_kg_paise?: number; available_until?: string }) =>
    client.patch<ApiSuccess<Listing>>(`/api/listings/${id}`, payload).then((r) => r.data),

  updateStatus: (id: string, status: 'active' | 'paused' | 'cancelled') =>
    client.patch<ApiSuccess<Listing>>(`/api/listings/${id}/status`, { status }).then((r) => r.data),

  recommended: (city?: string) =>
    client.get<ApiSuccess<Listing[]>>('/api/listings/recommended', { params: { city } }).then((r) => r.data),
}
