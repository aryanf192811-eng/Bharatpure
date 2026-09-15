import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ShoppingBag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { orderApi } from '@/api/order.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCartStore } from '@/stores/cart.store'

export default function Cart() {
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity, clearCart, total } = useCartStore()
  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '' })

  const checkoutMutation = useMutation({
    mutationFn: () =>
      orderApi.create({
        items: items.map((i) => ({ listing_id: i.listingId, quantity_kg: i.quantityKg })),
        delivery_address: address,
      }),
    onSuccess: (res) => {
      clearCart()
      navigate(`/consumer/orders/${res.data.id}/confirmation`)
    },
    onError: (err: AxiosError<{ error?: { message?: string } }>) => {
      toast.error(err.response?.data?.error?.message ?? 'Could not place order.')
    },
  })

  const addressComplete = address.line1 && address.city && address.state && address.pincode

  if (items.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <ShoppingBag className="size-10 text-earth-300" />
        <p className="text-sm text-earth-700">Your cart is empty.</p>
        <Link to="/consumer/browse" className="text-sm font-semibold text-primary-700 hover:underline">
          Browse verified produce
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">Cart</h1>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.listingId} className="flex items-center gap-3 rounded-md bg-white p-3 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-earth-900">{item.cropType}</p>
              <p className="text-xs text-earth-500">{item.fpoName}</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  step={0.5}
                  min={item.minOrderKg}
                  value={item.quantityKg}
                  onChange={(e) => updateQuantity(item.listingId, Number(e.target.value))}
                  className="w-20 rounded border border-earth-200 px-2 py-1 text-sm"
                />
                <span className="text-xs text-earth-500">kg</span>
              </div>
            </div>
            <p className="font-semibold text-earth-900">₹{((item.pricePerKgPaise * item.quantityKg) / 100).toFixed(0)}</p>
            <button type="button" onClick={() => removeItem(item.listingId)} aria-label="Remove item" className="text-danger">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
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

      <div className="rounded-md bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm">
          <span className="text-earth-700">Subtotal</span>
          <span className="font-semibold text-earth-900">₹{(total() / 100).toFixed(0)}</span>
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span className="text-earth-700">Delivery</span>
          <span className="font-semibold text-earth-900">Free</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-earth-100 pt-2 text-base">
          <span className="font-semibold text-earth-900">Total</span>
          <span className="font-bold text-primary-800">₹{(total() / 100).toFixed(0)}</span>
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={!addressComplete || checkoutMutation.isPending}
        onClick={() => checkoutMutation.mutate()}
      >
        {checkoutMutation.isPending ? 'Placing order...' : 'Proceed to Checkout'}
      </Button>
    </div>
  )
}
