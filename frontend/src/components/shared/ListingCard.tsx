import { Link } from 'react-router-dom'

import { QualityBadge } from '@/components/shared/QualityBadge'
import { getCropPhoto } from '@/lib/cropImagery'
import type { Listing } from '@/types/listing.types'

export function ListingCard({ listing, linkPrefix = '/consumer/listings' }: { listing: Listing; linkPrefix?: string }) {
  return (
    <Link
      to={`${linkPrefix}/${listing.id}`}
      className="flex w-full flex-col overflow-hidden rounded-md bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
    >
      <div className="h-28 overflow-hidden bg-primary-100">
        <img
          src={getCropPhoto(listing.crop_type, listing.batch_code.length)}
          alt={`${listing.crop_type} from ${listing.batch_code}`}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="font-mono text-xs text-earth-500">{listing.batch_code}</p>
        <h3 className="truncate text-lg font-semibold text-primary-800">{listing.crop_type}</h3>
        {listing.quality_score && <QualityBadge score={listing.quality_score} tier="NABL" />}
        <div className="mt-auto flex items-baseline justify-between pt-1">
          <span className="font-display text-xl font-bold text-primary-800">₹{(listing.price_per_kg_paise / 100).toFixed(0)}/kg</span>
          <span className="font-mono text-xs text-earth-500">Min {listing.min_order_kg}kg</span>
        </div>
      </div>
    </Link>
  )
}
