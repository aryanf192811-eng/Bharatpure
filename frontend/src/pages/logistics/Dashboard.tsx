import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Package, Thermometer } from 'lucide-react'
import { Link } from 'react-router-dom'

import { logisticsApi } from '@/api/logistics.api'
import { Skeleton } from '@/components/ui/skeleton'
import { HERO_IMAGES } from '@/lib/cropImagery'
import { useAuthStore } from '@/stores/auth.store'

export default function LogisticsDashboard() {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useQuery({ queryKey: ['logistics', 'dashboard'], queryFn: logisticsApi.dashboard })

  if (isLoading || !data) {
    return (
      <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const d = data.data

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
      <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
        <img src={HERO_IMAGES.driverPortrait} alt="" className="size-14 rounded-full object-cover shadow-sm" />
        <div>
          <p className="font-display text-lg font-semibold text-earth-900">{user?.full_name ?? 'Driver'}</p>
          <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Active Shift &middot; {new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {d.active_route ? (
        <Link
          to={`/logistics/routes/${d.active_route.route_id}`}
          className="flex items-center justify-between rounded-xl bg-primary-800 p-4 text-white shadow-sm hover:bg-primary-700"
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-primary-200">Active Route</p>
            <p className="text-lg font-bold">{d.active_route.stops_remaining} stops remaining</p>
          </div>
          <ArrowRight className="size-5" />
        </Link>
      ) : (
        <p className="rounded-xl bg-white p-4 text-center text-sm text-earth-500 shadow-sm">No active route right now.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Assigned Routes</p>
          <p className="mt-1 font-display text-2xl font-bold text-earth-900">{d.assigned_routes}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Completed Today</p>
          <p className="mt-1 font-display text-2xl font-bold text-earth-900">{d.completed_today}</p>
        </div>
      </div>

      <Link
        to="/logistics/temperature-log"
        className="flex items-center gap-3 rounded-xl bg-warning-bg p-4 text-warning shadow-sm hover:opacity-90"
      >
        <Thermometer className="size-6" />
        <span className="font-semibold">Log Temperature Reading</span>
      </Link>

      {d.pending_pickups > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm text-earth-700 shadow-sm">
          <Package className="size-4" /> {d.pending_pickups} pending pickup{d.pending_pickups > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
