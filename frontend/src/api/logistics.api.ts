import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface LogisticsDashboard {
  assigned_routes: number
  completed_today: number
  active_route: { route_id: string; stops_remaining: number; next_stop: Record<string, unknown> } | null
  pending_pickups: number
}

export interface RouteStop {
  id: string
  sequence_number: number
  stop_type: 'PICKUP' | 'DELIVERY' | 'HUB'
  address: string
  lat: number
  lng: number
  status: 'pending' | 'completed'
  actual_arrival_at: string | null
}

export interface Route {
  id: string
  status: 'assigned' | 'in_progress' | 'completed'
  total_distance_km: number
  estimated_time_min: number
  vehicle_id: string
  stops: RouteStop[]
}

export const logisticsApi = {
  dashboard: () => client.get<ApiSuccess<LogisticsDashboard>>('/api/logistics/dashboard').then((r) => r.data),

  listRoutes: (params?: { status?: string; date?: string }) =>
    client.get<ApiSuccess<Route[]>>('/api/logistics/routes', { params }).then((r) => r.data),

  getRoute: (routeId: string) => client.get<ApiSuccess<Route>>(`/api/logistics/routes/${routeId}`).then((r) => r.data),

  startRoute: (routeId: string) =>
    client.patch<ApiSuccess<Route>>(`/api/logistics/routes/${routeId}/start`).then((r) => r.data),

  completeStop: (routeId: string, stopId: string, notes?: string) =>
    client
      .patch<ApiSuccess<RouteStop>>(`/api/logistics/routes/${routeId}/stops/${stopId}/complete`, { notes })
      .then((r) => r.data),

  logTemperature: (payload: {
    batch_id: string
    route_id?: string
    temperature_c: number
    threshold_c: number
    vehicle_id: string
    location_lat?: number
    location_lng?: number
  }) =>
    client
      .post<ApiSuccess<{ breach_detected: boolean }>>('/api/logistics/temperature-log', payload)
      .then((r) => r.data),
}
