import { useQuery } from '@tanstack/react-query'
import { Award, Package, ShoppingCart, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buyerApi } from '@/api/buyer.api'
import { listingApi } from '@/api/listing.api'
import { orderApi } from '@/api/order.api'
import { ListingCard } from '@/components/shared/ListingCard'
import { Skeleton } from '@/components/ui/skeleton'
import { HERO_IMAGES } from '@/lib/cropImagery'

const formatRupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function BuyerDashboard() {
  const { data: profile } = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile })
  const { data: dashboard, isLoading } = useQuery({ queryKey: ['buyer', 'dashboard'], queryFn: buyerApi.dashboard })
  const { data: recommended } = useQuery({ queryKey: ['listings', 'recommended'], queryFn: () => listingApi.recommended() })
  const { data: pendingOrders } = useQuery({ queryKey: ['orders', 'confirmed'], queryFn: () => orderApi.list({ status: 'confirmed' }) })

  if (isLoading || !dashboard) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const d = dashboard.data
  const companyName = (profile?.data.company_name as string | undefined) ?? 'Your Company'

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-xl p-6 text-white shadow-sm">
        <img src={HERO_IMAGES.warehouseScene} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/95 via-primary-800/90 to-primary-700/80" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{companyName}</h1>
            <p className="mt-1 text-sm text-primary-200">Institutional Procurement Hub</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-primary-900/60 px-4 py-3">
              <Award className="size-6 text-gold-400" />
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-gold-400">Reliability Score</p>
                <p className="text-lg font-bold">{d.reliability_score !== null ? d.reliability_score.toFixed(0) : '—'} / 100</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-gold-50 px-4 py-3 text-earth-900">
              <Wallet className="size-6 text-gold-800" />
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-gold-800">Escrow Held</p>
                <p className="text-lg font-bold">{formatRupees(d.escrow_held_paise)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-earth-500">Active Orders</span>
            <ShoppingCart className="size-5 text-primary-700" />
          </div>
          <p className="font-display text-3xl font-bold text-earth-900">{d.active_orders}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-earth-500">Total Spent</span>
            <Wallet className="size-5 text-primary-700" />
          </div>
          <p className="font-display text-3xl font-bold text-earth-900">{formatRupees(d.total_spent_paise)}</p>
        </div>
        <Link to="/buyer/catalog" className="flex flex-col justify-between rounded-xl bg-primary-800 p-4 text-white shadow-sm hover:bg-primary-700">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-primary-200">Sourcing</span>
            <Package className="size-5" />
          </div>
          <p className="text-lg font-bold">Browse Catalog &rarr;</p>
        </Link>
      </div>

      {recommended && recommended.data.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-earth-900">Demand-matched batches</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recommended.data.map((l) => (
              <ListingCard key={l.id} listing={l} linkPrefix="/buyer/listings" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold text-earth-900">Pending Orders</h2>
        {!pendingOrders || pendingOrders.data.length === 0 ? (
          <p className="rounded-md bg-white p-6 text-center text-sm text-earth-500 shadow-sm">No pending orders.</p>
        ) : (
          <div className="overflow-x-auto rounded-md bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.data.map((o) => (
                  <tr key={o.id} className="border-b border-earth-50 last:border-b-0">
                    <td className="p-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                    <td className="p-3 font-semibold">{formatRupees(o.total_amount_paise)}</td>
                    <td className="p-3 capitalize">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
