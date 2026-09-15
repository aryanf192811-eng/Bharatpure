import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'
import type { Batch } from '@/types/batch.types'

export interface AdminDashboard {
  total_fpos: number
  total_batches: number
  active_listings: number
  total_orders: number
  escrow_held_paise: number
  iei: {
    total_orders: number
    avg_farmer_premium_rupees: number
    avg_distance_saved_km: number
    avg_logistics_saving_rupees: number
    settled_under_24h: number
  }
  demand_alerts: Array<{ crop_type: string; city: string; shortage_kg: number }>
}

export interface AdminUser {
  id: string
  role: string
  full_name: string
  status: string
  phone: string
  email: string | null
  created_at: string
}

export interface EscrowTransaction {
  id: string
  order_id: string
  amount_paise: number
  status: 'held' | 'released' | 'refunded' | 'partially_refunded'
  held_at: string
  released_at: string | null
}

export interface AuditLogEntry {
  id: string
  actor_id: string
  actor_role: string
  action: string
  entity_type: string
  entity_id: string
  old_value: unknown
  new_value: unknown
  created_at: string
}

export const adminApi = {
  dashboard: () => client.get<ApiSuccess<AdminDashboard>>('/api/admin/dashboard').then((r) => r.data),

  batches: (params?: { status?: string; fpo_id?: string; page?: number; limit?: number }) =>
    client.get<ApiPaginated<Batch>>('/api/admin/batches', { params }).then((r) => r.data),

  users: (params?: { role?: string; status?: string; page?: number; limit?: number }) =>
    client.get<ApiPaginated<AdminUser>>('/api/admin/users', { params }).then((r) => r.data),

  updateUserStatus: (userId: string, status: 'active' | 'suspended', reason: string) =>
    client.patch<ApiSuccess<AdminUser>>(`/api/admin/users/${userId}/status`, { status, reason }).then((r) => r.data),

  escrow: (params?: { status?: string; page?: number; limit?: number }) =>
    client.get<ApiPaginated<EscrowTransaction>>('/api/admin/escrow', { params }).then((r) => r.data),

  releaseEscrow: (escrowId: string, reason: string) =>
    client.post<ApiSuccess<EscrowTransaction>>(`/api/admin/escrow/${escrowId}/release`, { reason }).then((r) => r.data),

  iei: (params?: { from?: string; to?: string; crop_type?: string }) =>
    client.get<ApiSuccess<Record<string, unknown>>>('/api/admin/iei', { params }).then((r) => r.data),

  auditLogs: (params?: { entity_type?: string; entity_id?: string; page?: number; limit?: number }) =>
    client.get<ApiPaginated<AuditLogEntry>>('/api/admin/audit-logs', { params }).then((r) => r.data),

  optimizeRoutes: (payload: { order_ids: string[]; vehicle_type: string; depot_lat: number; depot_lng: number }) =>
    client.post<ApiSuccess<Record<string, unknown>>>('/api/admin/routes/optimize', payload).then((r) => r.data),

  triggerTrustScoreJob: () =>
    client.post<ApiSuccess<{ fpo_scores_computed: number }>>('/api/admin/jobs/trust-scores').then((r) => r.data),
}
