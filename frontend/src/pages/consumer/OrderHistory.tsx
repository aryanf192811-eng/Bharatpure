import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { orderApi } from '@/api/order.api'
import { Skeleton } from '@/components/ui/skeleton'

const TABS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'placed,confirmed,allocated,dispatched' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
] as const

export default function OrderHistory() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0])
  const { data, isLoading } = useQuery({
    queryKey: ['orders', tab.value],
    queryFn: () => orderApi.list({ status: tab.value }),
  })

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-3 p-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">My Orders</h1>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              tab.label === t.label ? 'bg-primary-800 text-white' : 'bg-earth-100 text-earth-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.data.length === 0 ? (
        <p className="rounded-md bg-white p-6 text-center text-sm text-earth-500 shadow-sm">No orders yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.data.map((order) => (
            <Link
              key={order.id}
              to={order.status === 'delivered' ? `/consumer/orders/${order.id}/confirmation` : `/consumer/orders/${order.id}/track`}
              className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm hover:shadow-md"
            >
              <div>
                <p className="font-mono text-xs text-earth-500">{order.id.slice(0, 8)}</p>
                <p className="text-xs text-earth-500">{new Date(order.created_at).toLocaleDateString('en-IN')}</p>
                <p className="mt-1 text-sm font-semibold capitalize text-earth-900">{order.status}</p>
              </div>
              <p className="font-display text-lg font-bold text-primary-800">₹{(order.total_amount_paise / 100).toFixed(0)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
