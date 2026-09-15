import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'
import type { DeliveryAddress, Order, OrderTracking } from '@/types/order.types'

export interface CreateOrderPayload {
  items: { listing_id: string; quantity_kg: number }[]
  delivery_address: DeliveryAddress
  delivery_notes?: string
  payment_reference?: string
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
}
