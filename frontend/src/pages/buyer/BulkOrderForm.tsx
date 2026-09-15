import { useMutation, useQuery } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { listingApi } from '@/api/listing.api'
import { orderApi } from '@/api/order.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LineItem {
  listingId: string
  batchCode: string
  cropType: string
  pricePerKgPaise: number
  quantityKg: number
}

export default function BulkOrderForm() {
  const navigate = useNavigate()
  const { data: listings } = useQuery({ queryKey: ['listings', 'bulk'], queryFn: () => listingApi.list({ limit: 50 }) })
  const [items, setItems] = useState<LineItem[]>([])
  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '' })

  const addressComplete = address.line1 && address.city && address.state && address.pincode
  const subtotal = items.reduce((sum, i) => sum + i.pricePerKgPaise * i.quantityKg, 0)

  const submitMutation = useMutation({
    mutationFn: () =>
      orderApi.create({
        items: items.map((i) => ({ listing_id: i.listingId, quantity_kg: i.quantityKg })),
        delivery_address: address,
      }),
    onSuccess: () => {
      toast.success('Bulk order placed.')
      navigate('/buyer/orders')
    },
    onError: (err: AxiosError<{ error?: { message?: string } }>) => {
      toast.error(err.response?.data?.error?.message ?? 'Could not place order.')
    },
  })

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-earth-900">New Bulk Order</h1>

      <div className="overflow-x-auto rounded-md bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
              <th className="p-3">Batch</th>
              <th className="p-3">Quantity (kg)</th>
              <th className="p-3">Price/kg</th>
              <th className="p-3">Subtotal</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.listingId} className="border-b border-earth-50">
                <td className="p-3">
                  {item.cropType} <span className="font-mono text-xs text-earth-500">{item.batchCode}</span>
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    value={item.quantityKg}
                    onChange={(e) => {
                      const next = [...items]
                      next[idx].quantityKg = Number(e.target.value)
                      setItems(next)
                    }}
                    className="w-24"
                  />
                </td>
                <td className="p-3">₹{(item.pricePerKgPaise / 100).toFixed(0)}</td>
                <td className="p-3 font-semibold">₹{((item.pricePerKgPaise * item.quantityKg) / 100).toFixed(0)}</td>
                <td className="p-3">
                  <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-earth-500">
                  No items added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-earth-900">+ Add another batch</p>
        <Select
          onValueChange={(id) => {
            const listing = listings?.data.find((l) => l.id === id)
            if (!listing || items.some((i) => i.listingId === id)) return
            setItems([
              ...items,
              { listingId: listing.id, batchCode: listing.batch_code, cropType: listing.crop_type, pricePerKgPaise: listing.price_per_kg_paise, quantityKg: listing.min_order_kg },
            ])
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a listing to add" />
          </SelectTrigger>
          <SelectContent>
            {listings?.data.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.crop_type} &mdash; {l.batch_code} &mdash; ₹{(l.price_per_kg_paise / 100).toFixed(0)}/kg
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <div className="rounded-md bg-info-bg p-3 text-sm text-earth-900">
        Payment held in secure escrow until delivery confirmed.
      </div>

      <div className="flex items-center justify-between rounded-md bg-white p-4 shadow-sm">
        <span className="text-sm text-earth-700">Order Total</span>
        <span className="font-display text-2xl font-bold text-primary-800">₹{(subtotal / 100).toFixed(0)}</span>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={items.length === 0 || !addressComplete || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? 'Placing order...' : 'Place Bulk Order'}
      </Button>
    </div>
  )
}
