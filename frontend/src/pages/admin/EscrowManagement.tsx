import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { adminApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'

const formatRupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const TABS = ['held', 'released', 'refunded'] as const

export default function EscrowManagement() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('held')
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const { data } = useQuery({ queryKey: ['admin', 'escrow', tab], queryFn: () => adminApi.escrow({ status: tab, limit: 50 }) })

  const releaseMutation = useMutation({
    mutationFn: ({ escrowId, reason }: { escrowId: string; reason: string }) => adminApi.releaseEscrow(escrowId, reason),
    onSuccess: () => {
      toast.success('Escrow released.')
      setReasonFor(null)
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'escrow'] })
    },
    onError: () => toast.error('Could not release escrow.'),
  })

  const totalHeld = data?.data.reduce((sum, e) => sum + e.amount_paise, 0) ?? 0

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">Escrow Management</h1>

      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Total {tab}</p>
        <p className="font-display text-2xl font-bold text-primary-800">{formatRupees(totalHeld)}</p>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm capitalize ${tab === t ? 'bg-primary-800 text-white' : 'bg-earth-100 text-earth-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
              <th className="p-3">Order ID</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Held Since</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((e) => (
              <tr key={e.id} className="border-b border-earth-50 last:border-b-0">
                <td className="p-3 font-mono text-xs">{e.order_id.slice(0, 8)}</td>
                <td className="p-3 font-semibold">{formatRupees(e.amount_paise)}</td>
                <td className="p-3">{new Date(e.held_at).toLocaleDateString('en-IN')}</td>
                <td className="p-3">
                  {e.status === 'held' &&
                    (reasonFor === e.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={reason}
                          onChange={(ev) => setReason(ev.target.value)}
                          placeholder="Reason"
                          className="rounded border border-earth-200 px-2 py-1 text-xs"
                        />
                        <Button
                          size="sm"
                          disabled={!reason || releaseMutation.isPending}
                          onClick={() => releaseMutation.mutate({ escrowId: e.id, reason })}
                        >
                          Confirm
                        </Button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setReasonFor(e.id)} className="text-primary-700 hover:underline">
                        Release
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
