import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Thermometer } from 'lucide-react'
import { useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { logisticsApi } from '@/api/logistics.api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { coldStorageMarkerIcon, defaultMarkerIcon } from '@/lib/leafletIcons'

export default function RouteMapView() {
  const { routeId } = useParams<{ routeId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['logistics', 'route', routeId],
    queryFn: () => logisticsApi.getRoute(routeId!),
    enabled: !!routeId,
  })

  const startMutation = useMutation({
    mutationFn: () => logisticsApi.startRoute(routeId!),
    onSuccess: () => {
      toast.success('Route started.')
      queryClient.invalidateQueries({ queryKey: ['logistics', 'route', routeId] })
    },
  })

  if (isLoading || !data) {
    return <Skeleton className="h-full min-h-[60vh] w-full" />
  }

  const route = data.data
  const positions = route.stops.map((s) => [s.latitude, s.longitude] as [number, number])
  const currentStop = route.stops.find((s) => !s.completed_at)
  const center = positions[0] ?? [20.5937, 78.9629]

  return (
    <div className="relative h-[calc(100vh-120px)] w-full">
      <MapContainer center={center} zoom={11} className="size-full" scrollWheelZoom={false}>
        <TileLayer url={import.meta.env.VITE_MAPS_TILE_URL} attribution="&copy; OpenStreetMap" />
        {positions.length > 1 && <Polyline positions={positions} color="#1B4332" />}
        {route.stops.map((stop) => {
          const isColdStorageReroute = stop.stop_type === 'HUB' && Boolean(stop.batch_id)
          return (
            <Marker key={stop.id} position={[stop.latitude, stop.longitude]} icon={isColdStorageReroute ? coldStorageMarkerIcon : defaultMarkerIcon}>
              <Popup>
                #{stop.sequence_number} &middot; {isColdStorageReroute ? 'COLD STORAGE DROP' : stop.stop_type} &middot; {stop.location_name}
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      <div
        className={`absolute inset-x-0 bottom-0 z-[1000] rounded-t-lg bg-white shadow-lg transition-all ${expanded ? 'h-2/5' : 'h-auto'}`}
      >
        <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full py-2">
          <span className="mx-auto block h-1 w-10 rounded-full bg-earth-300" />
        </button>
        <div className="max-h-full overflow-y-auto px-4 pb-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-earth-900">
              {route.total_distance_km} km &middot; {route.vehicle_id}
            </p>
            <div className="flex items-center gap-2">
              <Link
                to={`/logistics/temperature-log?routeId=${routeId}`}
                className="flex items-center gap-1 rounded-md bg-danger-bg px-2.5 py-1.5 text-xs font-semibold text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
              >
                <Thermometer className="size-3.5" /> Report Temp
              </Link>
              {route.status === 'planned' && (
                <Button type="button" size="sm" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                  Start Route
                </Button>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {route.stops.map((stop) => {
              const isColdStorageReroute = stop.stop_type === 'HUB' && Boolean(stop.batch_id)
              return (
                <Link
                  key={stop.id}
                  to={`/logistics/routes/${routeId}/stops/${stop.id}`}
                  className={`flex items-center justify-between rounded-md p-2 text-sm ${
                    isColdStorageReroute
                      ? 'bg-info-bg font-semibold text-info'
                      : stop.id === currentStop?.id
                        ? 'bg-primary-100 font-semibold text-primary-800'
                        : 'bg-earth-50 text-earth-700'
                  }`}
                >
                  <span>
                    #{stop.sequence_number} {isColdStorageReroute ? '❄️ COLD STORAGE' : stop.stop_type} &middot; {stop.location_name}
                  </span>
                  <span className="text-xs uppercase">{stop.completed_at ? 'completed' : 'pending'}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/logistics/dashboard')}
        className="absolute left-3 top-3 z-[1000] rounded-full bg-white p-2 shadow-md"
        aria-label="Back"
      >
        &larr;
      </button>
    </div>
  )
}
