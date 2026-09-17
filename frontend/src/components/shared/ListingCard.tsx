import { Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'

import { QualityBadge } from '@/components/shared/QualityBadge'
import { getCropPhoto } from '@/lib/cropImagery'
import type { Listing } from '@/types/listing.types'

export function ListingCard({ listing, linkPrefix = '/consumer/listings' }: { listing: Listing; linkPrefix?: string }) {
  return (
    <Link
      to={`${linkPrefix}/${listing.id}`}
      className="flex w-full flex-col overflow-hidden rounded-md border border-border bg-white shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
    >
      <div className="relative h-28 overflow-hidden bg-primary-100">
        <img
          src={getCropPhoto(listing.crop_type, listing.batch_code.length)}
          alt={`${listing.crop_type} from ${listing.batch_code}`}
          loading="lazy"
          className="size-full object-cover"
        />
        {listing.quality_score !== null && listing.quality_score >= 90 && (
          <span className="absolute right-2 top-2 rounded-full bg-success px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            Verified Fresh
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="font-mono text-xs text-earth-500">{listing.batch_code}</p>
        <h3 className="truncate text-lg font-semibold text-primary-800">{listing.crop_type}</h3>

        {listing.fpo_name && (
          <div className="flex items-center gap-1 text-xs text-earth-600">
            <Sprout className="size-3.5 shrink-0 text-primary-600" />
            <span className="truncate">{listing.fpo_name}</span>
          </div>
        )}

        {listing.quality_score !== null && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <QualityBadge score={listing.quality_score} tier="NABL" />
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-earth-100">
              <div
                className={`h-full rounded-full ${listing.quality_score >= 90 ? 'bg-success' : listing.quality_score >= 70 ? 'bg-gold-600' : 'bg-danger'}`}
                style={{ width: `${Math.min(listing.quality_score, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-baseline justify-between pt-1">
          <span className="font-display text-xl font-bold text-primary-800">₹{(listing.price_per_kg_paise / 100).toFixed(0)}/kg</span>
          <span className="font-mono text-xs text-earth-500">Min {listing.min_order_kg}kg</span>
        </div>
        {/* No platform commission exists anywhere in escrow release -- the full listing price
            settles to the farmer, so this is a real fact, not a marketing claim. */}
        <p className="font-mono text-[10px] uppercase tracking-wider text-primary-700">Zero commission — farmer gets it all</p>
      </div>
    </Link>
  )
}
