import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { logisticsApi } from '@/api/logistics.api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function StopDetail() {
  const { routeId, stopId } = useParams<{ routeId: string; stopId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [checks, setChecks] = useState({ sealed: false, recipient: false })

  const { data, isLoading } = useQuery({
    queryKey: ['logistics', 'route', routeId],
    queryFn: () => logisticsApi.getRoute(routeId!),
    enabled: !!routeId,
  })

  const completeMutation = useMutation({
    mutationFn: () => logisticsApi.completeStop(routeId!, stopId!),
    onSuccess: () => {
      toast.success('Stop marked complete.')
      queryClient.invalidateQueries({ queryKey: ['logistics', 'route', routeId] })
      navigate(`/logistics/routes/${routeId}`)
    },
    onError: () => toast.error('Could not complete this stop.'),
  })

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />
  }

  const stop = data.data.stops.find((s) => s.id === stopId)
  if (!stop) return <p className="p-4 text-sm text-earth-500">Stop not found.</p>

  const isDelivery = stop.stop_type === 'DELIVERY'
  const canComplete = !isDelivery || (checks.sealed && checks.recipient)

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
      <span
        className={`w-fit rounded-full px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider ${
          stop.stop_type === 'PICKUP' ? 'bg-primary-100 text-primary-800' : stop.stop_type === 'DELIVERY' ? 'bg-success-bg text-success' : 'bg-info-bg text-info'
        }`}
      >
        {stop.stop_type}
      </span>

      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-earth-900">
          <MapPin className="size-4 text-earth-500" /> {stop.location_name}
        </p>
        <a
          href={`https://www.google.com/maps?q=${stop.latitude},${stop.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1 text-sm text-primary-700 hover:underline"
        >
          Open in Maps <ExternalLink className="size-3.5" />
        </a>
      </div>

      {isDelivery && (
        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-earth-900">Confirmation Checklist</p>
          <label className="flex items-center gap-2 py-1 text-sm text-earth-700">
            <input type="checkbox" checked={checks.sealed} onChange={(e) => setChecks({ ...checks, sealed: e.target.checked })} />
            Items sealed and intact
          </label>
          <label className="flex items-center gap-2 py-1 text-sm text-earth-700">
            <input type="checkbox" checked={checks.recipient} onChange={(e) => setChecks({ ...checks, recipient: e.target.checked })} />
            Correct recipient
          </label>
        </div>
      )}

      <Button type="button" size="lg" disabled={!canComplete || completeMutation.isPending} onClick={() => completeMutation.mutate()}>
        {completeMutation.isPending ? 'Completing...' : 'Complete Stop'}
      </Button>
    </div>
  )
}
