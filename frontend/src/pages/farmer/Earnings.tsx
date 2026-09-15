import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { farmerApi } from '@/api/farmer.api'
import { Skeleton } from '@/components/ui/skeleton'

const RANGES = [
  { label: 'This Month', months: 1 },
  { label: 'Last 3 Months', months: 3 },
  { label: 'This Year', months: 12 },
] as const

const formatRupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function Earnings() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0])

  const from = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - range.months)
    return d.toISOString().slice(0, 10)
  }, [range])

  const { data, isLoading } = useQuery({
    queryKey: ['farmer', 'earnings', from],
    queryFn: () => farmerApi.earnings({ from }),
  })

  const rows = data?.data ?? []
  const totalEarned = rows.reduce((sum, r) => sum + r.total_paise, 0)
  const totalBatches = rows.length

  const chartData = useMemo(() => {
    const byMonth = new Map<string, number>()
    // total_paise per batch isn't date-stamped in this response, so bucket everything under a
    // single "Selected Period" bar rather than fabricating monthly breakdowns from data we don't have.
    byMonth.set('Selected Period', totalEarned)
    return Array.from(byMonth, ([month, amount]) => ({ month, amount: amount / 100 }))
  }, [totalEarned])

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-5 p-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-earth-900">Earnings</h1>

      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-full px-4 py-2 text-xs font-medium ${
              range.label === r.label ? 'bg-primary-800 text-white' : 'bg-earth-100 text-earth-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-white p-3 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Total Earned</p>
              <p className="mt-1 font-display text-2xl font-bold text-primary-800">{formatRupees(totalEarned)}</p>
            </div>
            <div className="rounded-md bg-white p-3 shadow-sm">
              <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Batches Sold</p>
              <p className="mt-1 font-display text-2xl font-bold text-earth-900">{totalBatches}</p>
            </div>
          </div>

          <div className="h-[180px] rounded-md bg-white p-3 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} />
                <Bar dataKey="amount" fill="#40916C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-earth-900">Per-batch breakdown</p>
            {rows.length === 0 ? (
              <p className="rounded-md bg-white p-4 text-center text-sm text-earth-500 shadow-sm">
                No earnings recorded for this period.
              </p>
            ) : (
              rows.map((row) => (
                <Link
                  key={row.batch_id}
                  to={`/farmer/batches/${row.batch_id}`}
                  className="flex items-center justify-between rounded-md bg-white p-3 shadow-sm hover:shadow-md"
                >
                  <div>
                    <p className="font-mono text-xs text-earth-500">{row.batch_code}</p>
                    <p className="text-sm font-semibold text-earth-900">{row.crop_type}</p>
                    <p className="text-xs text-earth-500">{row.quantity_sold_kg} kg sold</p>
                  </div>
                  <p className="font-display text-lg font-bold text-primary-800">{formatRupees(row.total_paise)}</p>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
