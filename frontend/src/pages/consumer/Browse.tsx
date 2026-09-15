import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'

import { listingApi } from '@/api/listing.api'
import { ListingCard } from '@/components/shared/ListingCard'
import { Skeleton } from '@/components/ui/skeleton'

const CROPS = ['All', 'TURMERIC', 'MUSTARD', 'HONEY', 'WHEAT', 'RICE']

export default function ConsumerBrowse() {
  const [crop, setCrop] = useState('All')
  const [search, setSearch] = useState('')

  const { data: recommended } = useQuery({
    queryKey: ['listings', 'recommended'],
    queryFn: () => listingApi.recommended(),
  })
  const { data: listings, isLoading } = useQuery({
    queryKey: ['listings', crop],
    queryFn: () => listingApi.list({ crop_type: crop === 'All' ? undefined : crop, limit: 20 }),
  })

  const filtered = listings?.data.filter((l) => l.crop_type.toLowerCase().includes(search.toLowerCase()) || search === '') ?? []

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-earth-500" />
        <input
          type="text"
          placeholder="Search by crop, FPO, or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded bg-white py-3 pl-10 pr-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {CROPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCrop(c)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-sm ${
              crop === c ? 'bg-primary-800 text-white' : 'bg-white text-earth-900 hover:bg-earth-100'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {recommended && recommended.data.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-body text-lg font-semibold text-earth-900">Recommended for you</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {recommended.data.map((l) => (
              <div key={l.id} className="w-[200px] shrink-0">
                <ListingCard listing={l} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-body text-lg font-semibold text-earth-900">All verified listings</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-md bg-white p-6 text-center text-sm text-earth-500 shadow-sm">No listings found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
