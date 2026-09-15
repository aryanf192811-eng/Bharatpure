import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { listingApi } from '@/api/listing.api'
import { orderApi } from '@/api/order.api'
import { BIRTimeline } from '@/components/shared/BIRTimeline'
import { QualityBadge } from '@/components/shared/QualityBadge'
import { TrustScoreRing } from '@/components/shared/TrustScoreRing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getCropPhoto } from '@/lib/cropImagery'

export default function BatchDetailBuyer() {
  const { listingId } = useParams<{ listingId: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => listingApi.getById(listingId!),
    enabled: !!listingId,
  })
  const [quantity, setQuantity] = useState(0)
  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '' })

  const orderMutation = useMutation({
    mutationFn: () =>
      orderApi.create({ items: [{ listing_id: listingId!, quantity_kg: quantity }], delivery_address: address }),
    onSuccess: (res) => {
      toast.success('Order placed.')
      navigate(`/buyer/orders`)
      void res
    },
    onError: (err: AxiosError<{ error?: { message?: string } }>) => {
      toast.error(err.response?.data?.error?.message ?? 'Could not place order.')
    },
  })

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const listing = data.data
  const addressComplete = address.line1 && address.city && address.state && address.pincode
  const total = quantity * listing.price_per_kg_paise

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <img src={getCropPhoto(listing.crop_type)} alt={listing.crop_type} className="h-56 w-full rounded-md object-cover shadow-sm" />
        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="font-mono text-xs text-earth-500">{listing.batch_code}</p>
          <h1 className="font-display text-2xl font-bold text-earth-900">{listing.crop_type}</h1>
          <p className="mt-1 text-sm text-earth-500">
            {listing.cluster_name} &middot; {listing.district}, {listing.state}
          </p>
          {listing.quality_score && <QualityBadge score={listing.quality_score} tier="NABL" />}
        </div>

        {listing.fpo_trust_score !== null && (
          <div className="flex items-center gap-3 rounded-md bg-white p-4 shadow-sm">
            <TrustScoreRing score={Number(listing.fpo_trust_score)} size="md" />
            <div>
              <p className="text-sm font-semibold text-earth-900">{listing.fpo_name}</p>
              <p className="text-xs text-earth-500">FPO Trust Score</p>
            </div>
          </div>
        )}

        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-earth-900">Batch Identity Record</p>
          <BIRTimeline events={[...listing.bir_events].reverse()} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="text-sm text-earth-500">Available at</p>
          <p className="font-display text-2xl font-bold text-primary-800">₹{(listing.price_per_kg_paise / 100).toFixed(0)}/kg</p>
          <div className="mt-3">
            <label className="text-sm font-medium text-earth-700">Order quantity (kg)</label>
            <Input
              type="number"
              min={listing.min_order_kg}
              max={listing.max_order_kg ?? undefined}
              value={quantity || ''}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-earth-500">
              Min {listing.min_order_kg} kg{listing.max_order_kg ? ` · Max ${listing.max_order_kg} kg` : ''}
            </p>
          </div>
          {quantity > 0 && (
            <p className="mt-3 text-lg font-bold text-earth-900">Total: ₹{(total / 100).toFixed(0)}</p>
          )}
        </div>

        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-earth-900">Delivery Address</p>
          <div className="flex flex-col gap-2">
            <Input placeholder="Address line" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              <Input placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
            </div>
            <Input placeholder="Pincode" value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} />
          </div>
        </div>

        <Button
          type="button"
          size="lg"
          disabled={!addressComplete || quantity < listing.min_order_kg || orderMutation.isPending}
          onClick={() => orderMutation.mutate()}
        >
          {orderMutation.isPending ? 'Placing order...' : 'Place Order'}
        </Button>
      </div>
    </div>
  )
}
