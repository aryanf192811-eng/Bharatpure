import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { orderApi } from '@/api/order.api'
import { Skeleton } from '@/components/ui/skeleton'

export default function OrderHistoryBuyer() {
  const { data, isLoading } = useQuery({ queryKey: ['orders', 'buyer'], queryFn: () => orderApi.list({ limit: 50 }) })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">Order History</h1>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data || data.data.length === 0 ? (
        <p className="rounded-md bg-white p-8 text-center text-sm text-earth-500 shadow-sm">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
                <th className="p-3">Order Date</th>
                <th className="p-3">Order ID</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((order) => (
                <tr key={order.id} className="border-b border-earth-50 last:border-b-0">
                  <td className="p-3">{new Date(order.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="p-3 font-mono text-xs">{order.id.slice(0, 8)}</td>
                  <td className="p-3 font-semibold">₹{(order.total_amount_paise / 100).toFixed(0)}</td>
                  <td className="p-3 capitalize">{order.status}</td>
                  <td className="p-3">
                    <Link to={`/buyer/orders`} className="text-primary-700 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
