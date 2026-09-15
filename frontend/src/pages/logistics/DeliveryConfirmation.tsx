import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { orderApi } from '@/api/order.api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

export default function DeliveryConfirmation() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const [checks, setChecks] = useState({ delivered: false, recipient: false, sealed: false })
  const [notes, setNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderApi.getById(orderId!),
    enabled: !!orderId,
  })

  const mutation = useMutation({
    mutationFn: () => orderApi.markDelivered(orderId!),
    onSuccess: () => {
      toast.success('Delivery confirmed.')
      navigate('/logistics/dashboard')
    },
    onError: (err: AxiosError<{ error?: { code?: string; message?: string } }>) => {
      const code = err.response?.data?.error?.code
      toast.error(
        code === 'TEMPERATURE_BREACH_REVIEW'
          ? 'Blocked: a temperature breach on this batch is still under admin review.'
          : (err.response?.data?.error?.message ?? 'Could not confirm delivery.'),
      )
    },
  })

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />
  }

  const order = data.data
  const allChecked = checks.delivered && checks.recipient && checks.sealed

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">Confirm Delivery</h1>

      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="font-mono text-xs text-earth-500">{order.id}</p>
        <p className="mt-1 text-sm text-earth-700">{order.items?.length ?? 0} item(s) &middot; ₹{(order.total_amount_paise / 100).toFixed(0)}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm text-earth-700">
          <input type="checkbox" checked={checks.delivered} onChange={(e) => setChecks({ ...checks, delivered: e.target.checked })} />
          All items delivered
        </label>
        <label className="flex items-center gap-2 text-sm text-earth-700">
          <input type="checkbox" checked={checks.recipient} onChange={(e) => setChecks({ ...checks, recipient: e.target.checked })} />
          Recipient confirmed
        </label>
        <label className="flex items-center gap-2 text-sm text-earth-700">
          <input type="checkbox" checked={checks.sealed} onChange={(e) => setChecks({ ...checks, sealed: e.target.checked })} />
          Package seal intact
        </label>
      </div>

      <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <Button type="button" size="lg" disabled={!allChecked || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? 'Confirming...' : 'Confirm Delivery'}
      </Button>
    </div>
  )
}
