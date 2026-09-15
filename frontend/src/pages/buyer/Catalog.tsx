import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { listingApi } from '@/api/listing.api'
import { ListingCard } from '@/components/shared/ListingCard'
import { Skeleton } from '@/components/ui/skeleton'

const CROPS = ['', 'TURMERIC', 'MUSTARD', 'HONEY', 'WHEAT', 'RICE']

export default function Catalog() {
  const [cropType, setCropType] = useState('')
  const [minQuality, setMinQuality] = useState(0)
  const [sort, setSort] = useState('demand_match')

  const { data, isLoading } = useQuery({
    queryKey: ['listings', 'catalog', cropType, minQuality, sort],
    queryFn: () => listingApi.list({ crop_type: cropType || undefined, min_quality: minQuality || undefined, sort, limit: 24 }),
  })

  return (
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 rounded-md bg-white p-4 shadow-sm lg:flex">
        <div>
          <p className="mb-2 text-sm font-semibold text-earth-900">Crop Type</p>
          <div className="flex flex-col gap-1.5">
            {CROPS.map((c) => (
              <label key={c || 'any'} className="flex items-center gap-2 text-sm text-earth-700">
                <input type="radio" name="crop" checked={cropType === c} onChange={() => setCropType(c)} />
                {c || 'Any'}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-earth-900">Min Quality Score</p>
          <input
            type="range"
            min={0}
            max={100}
            value={minQuality}
            onChange={(e) => setMinQuality(Number(e.target.value))}
            className="w-full"
          />
          <p className="mt-1 text-xs text-earth-500">{minQuality}+ / 100</p>
        </div>
      </aside>

      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-earth-900">Verified Batch Catalog</h1>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded border border-earth-200 px-2 py-1.5 text-sm">
            <option value="demand_match">Sort: Demand match</option>
            <option value="quality_score_desc">Sort: Quality</option>
          </select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : !data || data.data.length === 0 ? (
          <p className="rounded-md bg-white p-8 text-center text-sm text-earth-500 shadow-sm">No batches match these filters.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.data.map((l) => (
              <ListingCard key={l.id} listing={l} linkPrefix="/buyer/listings" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
