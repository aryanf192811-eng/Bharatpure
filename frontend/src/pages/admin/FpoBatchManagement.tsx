import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { adminApi } from '@/api/admin.api'
import { batchApi } from '@/api/batch.api'
import { BatchStatusPill } from '@/components/shared/BatchStatusPill'
import type { BatchStatus } from '@/types/batch.types'

const STATUS_OPTIONS: BatchStatus[] = [
  'pending_test', 'test_passed', 'test_failed', 'listed', 'partially_sold', 'sold', 'dispatched', 'delivered', 'rejected_post_delivery',
]

export default function FpoBatchManagement() {
  const [tab, setTab] = useState<'fpos' | 'batches'>('batches')
  const queryClient = useQueryClient()

  const { data: farmers } = useQuery({ queryKey: ['admin', 'users', 'FARMER'], queryFn: () => adminApi.users({ role: 'FARMER', limit: 50 }), enabled: tab === 'fpos' })
  const { data: batches } = useQuery({ queryKey: ['admin', 'batches'], queryFn: () => adminApi.batches({ limit: 50 }), enabled: tab === 'batches' })

  const overrideMutation = useMutation({
    mutationFn: ({ batchId, status }: { batchId: string; status: BatchStatus }) => batchApi.updateStatus(batchId, status),
    onSuccess: () => {
      toast.success('Batch status overridden.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] })
    },
    onError: () => toast.error('Invalid status transition.'),
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">FPO &amp; Batch Management</h1>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('batches')} className={`rounded-full px-4 py-1.5 text-sm ${tab === 'batches' ? 'bg-primary-800 text-white' : 'bg-earth-100 text-earth-700'}`}>
          Batches
        </button>
        <button type="button" onClick={() => setTab('fpos')} className={`rounded-full px-4 py-1.5 text-sm ${tab === 'fpos' ? 'bg-primary-800 text-white' : 'bg-earth-100 text-earth-700'}`}>
          Farmers / FPOs
        </button>
      </div>

      {tab === 'batches' ? (
        <div className="overflow-x-auto rounded-md bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
                <th className="p-3">Batch Code</th>
                <th className="p-3">Crop</th>
                <th className="p-3">Status</th>
                <th className="p-3">Quality</th>
                <th className="p-3">Override</th>
              </tr>
            </thead>
            <tbody>
              {batches?.data.map((b) => (
                <tr key={b.id} className="border-b border-earth-50 last:border-b-0">
                  <td className="p-3 font-mono text-xs">{b.batch_code}</td>
                  <td className="p-3">{b.crop_type}</td>
                  <td className="p-3"><BatchStatusPill status={b.status} /></td>
                  <td className="p-3">{b.quality_score ?? '—'}</td>
                  <td className="p-3">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value && confirm(`Override ${b.batch_code} to ${e.target.value}?`)) {
                          overrideMutation.mutate({ batchId: b.id, status: e.target.value as BatchStatus })
                        }
                      }}
                      className="rounded border border-earth-200 px-2 py-1 text-xs"
                    >
                      <option value="">Change status...</option>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
                <th className="p-3">Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {farmers?.data.map((f) => (
                <tr key={f.id} className="border-b border-earth-50 last:border-b-0">
                  <td className="p-3">{f.full_name}</td>
                  <td className="p-3 font-mono text-xs">{f.phone}</td>
                  <td className="p-3 capitalize">{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
