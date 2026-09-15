import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { logisticsApi } from '@/api/logistics.api'
import { Skeleton } from '@/components/ui/skeleton'

export default function RoutesList() {
  const { data, isLoading } = useQuery({ queryKey: ['logistics', 'routes'], queryFn: () => logisticsApi.listRoutes() })

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-3 p-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">My Routes</h1>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.data.length === 0 ? (
        <p className="rounded-md bg-white p-6 text-center text-sm text-earth-500 shadow-sm">No routes assigned today.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.data.map((route) => (
            <Link
              key={route.id}
              to={`/logistics/routes/${route.id}`}
              className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm hover:shadow-md"
            >
              <div>
                <p className="text-sm font-semibold text-earth-900">{route.vehicle_id}</p>
                <p className="text-xs text-earth-500">{route.stops.length} stops &middot; {route.total_distance_km} km</p>
              </div>
              <span className="rounded-full bg-earth-100 px-2 py-0.5 text-xs font-medium uppercase text-earth-700">{route.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
