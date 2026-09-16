import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface LogisticsDashboard {
  assigned_routes: number
  completed_today: number
  active_route: { route_id: string; stops_remaining: number; next_stop: Record<string, unknown> } | null
  pending_pickups: number
}

// Field names match the real route_stops table exactly (SELECT * is what the backend returns) --
// latitude/longitude, not lat/lng; location_name, not address; completion is tracked via
// completed_at being non-null, there's no separate status column.
export interface RouteStop {
  id: string
  route_id: string
  order_id: string | null
  batch_id: string | null
  stop_type: 'PICKUP' | 'DELIVERY' | 'HUB'
  sequence_number: number
  location_name: string | null
  latitude: number
  longitude: number
  arrival_window_start: string | null
  arrival_window_end: string | null
  actual_arrival_at: string | null
  completed_at: string | null
  notes: string | null
}

export interface Route {
  id: string
  route_name: string | null
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  total_distance_km: number
  estimated_duration_h: number | null
  vehicle_type: string
  vehicle_id: string
  driver_id: string | null
  baseline_distance_km: number | null
  cost_estimate_paise: number | null
  baseline_cost_paise: number | null
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
      .patch<
        ApiSuccess<{ id: string; completed: boolean; order_delivery: unknown; cold_storage_review_resolved: boolean }>
      >(`/api/logistics/routes/${routeId}/stops/${stopId}/complete`, { notes })
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
      .post<
        ApiSuccess<{
          breach_detected: boolean
          reroute: { stop_id: string; facility_name: string; distance_km: number } | null
        }>
      >('/api/logistics/temperature-log', payload)
      .then((r) => r.data),
}
