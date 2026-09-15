import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { logisticsApi } from '@/api/logistics.api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { defaultMarkerIcon } from '@/lib/leafletIcons'

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
  const positions = route.stops.map((s) => [s.lat, s.lng] as [number, number])
  const currentStop = route.stops.find((s) => s.status === 'pending')
  const center = positions[0] ?? [20.5937, 78.9629]

  return (
    <div className="relative h-[calc(100vh-120px)] w-full">
      <MapContainer center={center} zoom={11} className="size-full" scrollWheelZoom={false}>
        <TileLayer url={import.meta.env.VITE_MAPS_TILE_URL} attribution="&copy; OpenStreetMap" />
        {positions.length > 1 && <Polyline positions={positions} color="#1B4332" />}
        {route.stops.map((stop) => (
          <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={defaultMarkerIcon}>
            <Popup>
              #{stop.sequence_number} &middot; {stop.stop_type} &middot; {stop.address}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div
        className={`absolute inset-x-0 bottom-0 z-[1000] rounded-t-lg bg-white shadow-lg transition-all ${expanded ? 'h-2/5' : 'h-auto'}`}
      >
        <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full py-2">
          <span className="mx-auto block h-1 w-10 rounded-full bg-earth-300" />
        </button>
        <div className="max-h-full overflow-y-auto px-4 pb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-earth-900">
              {route.total_distance_km} km &middot; ~{route.estimated_time_min} min &middot; {route.vehicle_id}
            </p>
            {route.status === 'assigned' && (
              <Button type="button" size="sm" disabled={startMutation.isPending} onClick={() => startMutation.mutate()}>
                Start Route
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {route.stops.map((stop) => (
              <Link
                key={stop.id}
                to={`/logistics/routes/${routeId}/stops/${stop.id}`}
                className={`flex items-center justify-between rounded-md p-2 text-sm ${
                  stop.id === currentStop?.id ? 'bg-primary-100 font-semibold text-primary-800' : 'bg-earth-50 text-earth-700'
                }`}
              >
                <span>
                  #{stop.sequence_number} {stop.stop_type} &middot; {stop.address}
                </span>
                <span className="text-xs uppercase">{stop.status}</span>
              </Link>
            ))}
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
