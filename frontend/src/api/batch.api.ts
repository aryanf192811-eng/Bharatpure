import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'
import type { Batch, BatchStatus } from '@/types/batch.types'

export interface CreateBatchPayload {
  cluster_id: string
  crop_type: string
  harvest_date: string
  total_quantity_kg: number
  notes?: string
}

export const batchApi = {
  list: (params?: { status?: string; crop_type?: string; page?: number; limit?: number }) =>
    client.get<ApiPaginated<Batch>>('/api/batches', { params }).then((r) => r.data),

  getById: (id: string) => client.get<ApiSuccess<Batch>>(`/api/batches/${id}`).then((r) => r.data),

  create: (payload: CreateBatchPayload) =>
    client.post<ApiSuccess<Batch>>('/api/batches', payload).then((r) => r.data),

  updateStatus: (id: string, status: BatchStatus) =>
    client.patch<ApiSuccess<{ id: string; status: BatchStatus }>>(`/api/batches/${id}/status`, { status }).then((r) => r.data),

  remove: (id: string) => client.delete(`/api/batches/${id}`).then((r) => r.data),

  clearTemperatureBreach: (id: string, review_notes: string) =>
    client
      .patch<ApiSuccess<Batch>>(`/api/batches/${id}/temperature-breach-clear`, { review_notes })
      .then((r) => r.data),
}
