import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'
import type { DeliveryAddress, Order, OrderTracking } from '@/types/order.types'

export interface CreateOrderPayload {
  items: { listing_id: string; quantity_kg: number }[]
  delivery_address: DeliveryAddress
  delivery_notes?: string
  payment_reference?: string
}

export interface ImpactSummaryItem {
  batch_code: string
  crop_type: string
  fpo_name: string | null
  fpo_state: string | null
  quantity_kg: number
  price_per_kg_paise: number
  commodity_price_per_kg_paise: number | null
  traditional_paise: number | null
  bharatpure_paise: number
}

export interface ImpactSummary {
  order_id: string
  items: ImpactSummaryItem[]
  total_traditional_paise: number
  total_bharatpure_paise: number
  total_uplift_paise: number
}

export const orderApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    client.get<ApiPaginated<Order>>('/api/orders', { params }).then((r) => r.data),

  getById: (id: string) => client.get<ApiSuccess<Order>>(`/api/orders/${id}`).then((r) => r.data),

  create: (payload: CreateOrderPayload) =>
    client.post<ApiSuccess<Order>>('/api/orders', payload).then((r) => r.data),

  cancel: (id: string, reason: string) =>
    client.patch<ApiSuccess<Order>>(`/api/orders/${id}/cancel`, { reason }).then((r) => r.data),

  confirm: (id: string) => client.patch<ApiSuccess<Order>>(`/api/orders/${id}/confirm`).then((r) => r.data),

  markDelivered: (id: string) => client.patch<ApiSuccess<Order>>(`/api/orders/${id}/delivered`).then((r) => r.data),

  track: (id: string) => client.get<ApiSuccess<OrderTracking>>(`/api/orders/${id}/track`).then((r) => r.data),

  getImpact: (id: string) => client.get<ApiSuccess<ImpactSummary>>(`/api/orders/${id}/impact`).then((r) => r.data),
}
