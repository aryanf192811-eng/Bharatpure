import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, Package, Receipt, Wallet } from 'lucide-react'

import { adminApi } from '@/api/admin.api'
import { IEIMetric } from '@/components/shared/IEIMetric'
import { Skeleton } from '@/components/ui/skeleton'

const formatRupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard })

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const d = data.data
  const stats = [
    { label: 'Total FPOs', value: d.total_fpos, icon: Building2 },
    { label: 'Total Batches', value: d.total_batches, icon: Package },
    { label: 'Active Listings', value: d.active_listings, icon: Package },
    { label: 'Total Orders', value: d.total_orders, icon: Receipt },
    { label: 'Escrow Held', value: formatRupees(d.escrow_held_paise), icon: Wallet },
    { label: 'Demand Alerts', value: d.demand_alerts.length, icon: AlertTriangle },
  ]

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-md bg-primary-800 p-8 text-white shadow-sm">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">National Agricultural Intermediation Operations</h1>
        <p className="mt-2 max-w-2xl text-sm text-primary-200">
          Real-time DPI pipeline orchestrating FPO-to-consumer value transfer, escrow assurance, and NABL batch-level certification.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center justify-between rounded-md bg-white p-4 shadow-sm">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-earth-500">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-earth-900">{s.value}</p>
            </div>
            <div className="flex size-10 items-center justify-center rounded bg-primary-50 text-primary-700">
              <s.icon className="size-5" />
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-md border border-gold-400 bg-gold-100 p-6">
        <h2 className="font-display text-xl font-bold text-earth-900">Intermediation Efficiency Index</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <IEIMetric label="Total Orders" before="—" after={String(d.iei.total_orders)} delta="tracked" />
          <IEIMetric label="Avg. Farmer Premium" before="commodity rate" after={`₹${d.iei.avg_farmer_premium_rupees}/kg`} delta="+premium" />
          <IEIMetric label="Avg. Distance Saved" before="baseline route" after={`${d.iei.avg_distance_saved_km} km`} delta="-distance" />
          <IEIMetric label="Avg. Logistics Saving" before="baseline cost" after={`₹${d.iei.avg_logistics_saving_rupees}`} delta="-cost" />
          <IEIMetric label="Settled Under 24h" before="4-7 days" after={`${d.iei.settled_under_24h} orders`} delta="-80%" />
        </div>
        <p className="mt-3 text-xs text-earth-500">Based on modelled estimates from prototype data.</p>
      </section>

      {d.demand_alerts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-bold text-earth-900">Demand Alerts</h2>
          {d.demand_alerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-bg p-3 text-sm text-earth-900">
              <AlertTriangle className="size-4 text-warning" />
              {alert.crop_type} shortage in {alert.city}: {alert.shortage_kg} kg
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
