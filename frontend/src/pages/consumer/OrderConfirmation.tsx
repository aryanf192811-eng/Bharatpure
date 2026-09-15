import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { orderApi } from '@/api/order.api'
import { Skeleton } from '@/components/ui/skeleton'

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderApi.getById(orderId!),
    enabled: !!orderId,
  })

  if (isLoading || !data) {
    return (
      <div className="p-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const order = data.data

  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-4 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary-100">
        <CheckCircle2 className="size-9 text-primary-700" />
      </div>
      <h1 className="font-display text-2xl font-bold text-earth-900">Order Placed!</h1>
      <p className="font-mono text-xs text-earth-500">{order.id}</p>

      <div className="w-full rounded-md bg-white p-4 text-left shadow-sm">
        <p className="text-sm font-semibold text-earth-900">Order Summary</p>
        {order.items?.map((item) => (
          <div key={item.id} className="mt-2 flex justify-between text-sm text-earth-700">
            <span>{item.quantity_kg} kg</span>
            <span>₹{(item.subtotal_paise / 100).toFixed(0)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-earth-100 pt-2 font-semibold text-earth-900">
          <span>Total</span>
          <span>₹{(order.total_amount_paise / 100).toFixed(0)}</span>
        </div>
      </div>

      <div className="w-full rounded-md bg-info-bg p-3 text-left text-sm text-earth-900">
        Your payment is held securely until delivery. Released only when you receive your order.
      </div>

      <Link
        to={`/consumer/orders/${order.id}/track`}
        className="w-full rounded-md bg-primary-800 py-3 text-center text-sm font-semibold text-white hover:bg-primary-700"
      >
        Track Order
      </Link>
      <Link to="/consumer/browse" className="text-sm font-medium text-primary-700 hover:underline">
        Continue Shopping
      </Link>
    </div>
  )
}
