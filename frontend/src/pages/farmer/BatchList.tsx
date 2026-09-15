import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { batchApi } from '@/api/batch.api'
import { BatchStatusPill } from '@/components/shared/BatchStatusPill'
import { QualityBadge } from '@/components/shared/QualityBadge'
import { Skeleton } from '@/components/ui/skeleton'
import type { BatchStatus } from '@/types/batch.types'

const FILTERS: { label: string; value: BatchStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Test', value: 'pending_test' },
  { label: 'Test Passed', value: 'test_passed' },
  { label: 'Test Failed', value: 'test_failed' },
  { label: 'Listed', value: 'listed' },
  { label: 'Partially Sold', value: 'partially_sold' },
  { label: 'Sold', value: 'sold' },
  { label: 'Dispatched', value: 'dispatched' },
  { label: 'Delivered', value: 'delivered' },
]

export default function BatchList() {
  const [filter, setFilter] = useState<BatchStatus | 'all'>('all')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['farmer', 'batches', filter, page],
    queryFn: () => batchApi.list({ status: filter === 'all' ? undefined : filter, page, limit: 20 }),
  })

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-earth-900">My Batches</h1>
        <Link
          to="/farmer/batches/new/step-1"
          className="flex items-center gap-0.5 rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
        >
          <Plus className="size-4" /> New Batch
        </Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => {
              setFilter(f.value)
              setPage(1)
            }}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2 ${
              filter === f.value ? 'bg-primary-800 text-white shadow-sm' : 'bg-earth-100 text-earth-700 hover:bg-earth-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !data || data.data.length === 0 ? (
        <p className="rounded-md bg-white p-6 text-center text-sm text-earth-500 shadow-sm">
          No {filter === 'all' ? '' : filter.replace('_', ' ')} batches.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.data.map((batch) => (
            <Link
              key={batch.id}
              to={`/farmer/batches/${batch.id}`}
              className="flex items-center gap-3 rounded-md bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-primary-800">{batch.batch_code}</span>
                  <BatchStatusPill status={batch.status} />
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-earth-900">{batch.crop_type}</p>
                <p className="text-xs text-earth-500">
                  {batch.total_quantity_kg} kg &middot; {new Date(batch.harvest_date).toLocaleDateString('en-IN')}
                </p>
              </div>
              {batch.quality_score && <QualityBadge score={Number(batch.quality_score)} tier="Rapid" />}
            </Link>
          ))}

          {data.pagination.page < data.pagination.totalPages && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-earth-200 bg-white py-2.5 text-sm font-semibold text-earth-700 hover:bg-earth-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  )
}
