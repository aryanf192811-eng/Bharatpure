import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useState } from 'react'
import { toast } from 'sonner'

import { adminApi } from '@/api/admin.api'
import { orderApi } from '@/api/order.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export default function RouteOptimization() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [vehicleType, setVehicleType] = useState('COLD_VAN')
  const [depot, setDepot] = useState({ lat: '19.076', lng: '72.877' })

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', 'confirmed', 'for-optimize'],
    queryFn: () => orderApi.list({ status: 'confirmed', limit: 50 }),
  })

  const optimizeMutation = useMutation({
    mutationFn: () =>
      adminApi.optimizeRoutes({
        order_ids: Array.from(selected),
        vehicle_type: vehicleType,
        depot_lat: Number(depot.lat),
        depot_lng: Number(depot.lng),
      }),
    onSuccess: () => toast.success('Route optimized and assigned.'),
    onError: (err: AxiosError<{ error?: { message?: string } }>) => {
      toast.error(err.response?.data?.error?.message ?? 'Optimization unavailable (AI service offline).')
    },
  })

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-earth-900">Route Optimization</h1>

      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-earth-900">Pending Deliveries</p>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !orders || orders.data.length === 0 ? (
          <p className="text-sm text-earth-500">No confirmed orders awaiting a route.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {orders.data.map((o) => (
              <label key={o.id} className="flex items-center gap-2 rounded p-2 text-sm hover:bg-earth-50">
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                <span className="font-mono text-xs text-earth-500">{o.id.slice(0, 8)}</span>
                <span>₹{(o.total_amount_paise / 100).toFixed(0)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-md bg-white p-4 shadow-sm">
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="rounded border border-earth-200 px-3 py-1.5 text-sm">
          <option value="COLD_VAN">Cold Van</option>
          <option value="DRY_VAN">Dry Van</option>
        </select>
        <Input placeholder="Depot lat" value={depot.lat} onChange={(e) => setDepot({ ...depot, lat: e.target.value })} />
        <Input placeholder="Depot lng" value={depot.lng} onChange={(e) => setDepot({ ...depot, lng: e.target.value })} />
      </div>

      <Button type="button" size="lg" disabled={selected.size === 0 || optimizeMutation.isPending} onClick={() => optimizeMutation.mutate()}>
        {optimizeMutation.isPending ? 'Optimizing...' : 'Run Optimization'}
      </Button>

      {optimizeMutation.isSuccess && (
        <div className="rounded-md bg-success-bg p-4 text-sm text-earth-900">
          Route created and assigned to available drivers.
        </div>
      )}
    </div>
  )
}
