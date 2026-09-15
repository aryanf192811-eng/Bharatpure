import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'

export interface Dispute {
  id: string
  order_id: string
  reason_category: string
  description: string
  status: 'open' | 'resolved' | 'refunded'
  resolution?: string
  refund_amount_paise?: number
  created_at: string
}

export const disputeApi = {
  create: (payload: { order_id: string; reason_category: string; description: string }) =>
    client.post<ApiSuccess<Dispute>>('/api/disputes', payload).then((r) => r.data),

  list: (params?: { status?: string; page?: number; limit?: number }) =>
    client.get<ApiPaginated<Dispute>>('/api/disputes', { params }).then((r) => r.data),

  getById: (id: string) => client.get<ApiSuccess<Dispute>>(`/api/disputes/${id}`).then((r) => r.data),

  resolve: (id: string, payload: { resolution: string; refund_amount_paise?: number; outcome: string }) =>
    client.patch<ApiSuccess<Dispute>>(`/api/disputes/${id}/resolve`, payload).then((r) => r.data),
}
