import { useQuery } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { listingApi } from '@/api/listing.api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getCropPhoto } from '@/lib/cropImagery'
import { useCartStore } from '@/stores/cart.store'

const STEPS = ['🌾 Farm', '⚙️ Process', '🧪 Test', '📦 Pack', '🚚 Deliver']

export default function ProductDetail() {
  const { listingId } = useParams<{ listingId: string }>()
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)
  const { data, isLoading } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => listingApi.getById(listingId!),
    enabled: !!listingId,
  })
  const [quantity, setQuantity] = useState(1)

  if (isLoading || !data) {
    return (
      <div className="p-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const listing = data.data
  const step = 0.5
  const total = (listing.price_per_kg_paise * quantity) / 100

  return (
    <div className="flex flex-col pb-24">
      <div className="relative h-48 overflow-hidden">
        <img src={getCropPhoto(listing.crop_type)} alt={listing.crop_type} className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-900/60 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-sm bg-primary-900/70 px-2 py-0.5 font-mono text-xs text-white">
          {listing.batch_code}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-sm text-earth-500">
            {listing.cluster_name} &middot; {listing.district}, {listing.state}
          </p>
          <h1 className="font-display text-2xl font-bold text-earth-900">{listing.crop_type}</h1>
        </div>

        <div className="rounded-md border-l-4 border-gold-600 bg-gold-100 p-3">
          <p className="text-sm font-semibold text-earth-900">Verified Quality</p>
          {listing.quality_score && (
            <p className="mt-1 font-display text-2xl font-bold text-gold-800">{listing.quality_score}/100</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-display text-3xl font-bold text-primary-800">₹{(listing.price_per_kg_paise / 100).toFixed(0)}/kg</span>
          <div className="flex items-center gap-2 rounded-lg bg-earth-100 p-1">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(listing.min_order_kg, q - step))}
              className="flex size-11 items-center justify-center rounded bg-white text-earth-900 shadow-sm"
            >
              <Minus className="size-4" />
            </button>
            <span className="min-w-14 text-center font-mono text-sm font-semibold">{quantity} kg</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(listing.max_order_kg ?? 9999, q + step))}
              className="flex size-11 items-center justify-center rounded bg-primary-800 text-white shadow-sm"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <p className="text-right text-sm text-earth-700">
          Total: <span className="font-semibold text-earth-900">₹{total.toFixed(0)}</span> for {quantity} kg
        </p>

        <div className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm">
          {STEPS.map((s) => (
            <span key={s} className="text-xs text-earth-700">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* sticky, not fixed -- fixed positions relative to the true browser viewport, which
          misbehaves inside embedded/iframe preview contexts (button can render off-screen even
          though it's "there"); sticky positions relative to PWAShell's own scrolling <main>,
          which is reliable everywhere this app is viewed. */}
      <div className="sticky bottom-16 mx-auto w-full max-w-[480px] bg-gradient-to-t from-earth-50 via-earth-50 to-transparent p-4 pt-8">
        <Button
          type="button"
          size="lg"
          className="w-full rounded-full shadow-md"
          onClick={() => {
            addItem({
              listingId: listing.id,
              batchCode: listing.batch_code,
              cropType: listing.crop_type,
              fpoName: listing.fpo_name ?? listing.cluster_name,
              pricePerKgPaise: listing.price_per_kg_paise,
              minOrderKg: listing.min_order_kg,
              maxOrderKg: listing.max_order_kg,
              quantityKg: quantity,
            })
            toast.success('Added to cart.')
            navigate('/consumer/cart')
          }}
        >
          Add to Cart
        </Button>
      </div>
    </div>
  )
}
