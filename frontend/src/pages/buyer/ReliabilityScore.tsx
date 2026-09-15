import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { buyerApi } from '@/api/buyer.api'
import { TrustScoreRing } from '@/components/shared/TrustScoreRing'
import { Skeleton } from '@/components/ui/skeleton'

function MetricBar({ label, value, inverted = false }: { label: string; value: number; inverted?: boolean }) {
  const good = inverted ? value <= 20 : value >= 70
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-earth-700">{label}</span>
        <span className={`font-semibold ${good ? 'text-success' : 'text-earth-900'}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-earth-100">
        <div className={`h-full rounded-full ${good ? 'bg-success' : 'bg-primary-600'}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

export default function ReliabilityScore() {
  const { data, isLoading, error } = useQuery({ queryKey: ['buyer', 'reliability'], queryFn: buyerApi.reliability, retry: false })

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  if (error || !data) {
    return (
      <div className="rounded-md bg-white p-8 text-center text-sm text-earth-500 shadow-sm">
        Reliability score has not been computed yet. It updates nightly after your first completed order.
      </div>
    )
  }

  const { latest, history } = data.data
  const chartData = history.map((h) => ({ date: new Date(h.computed_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), score: Number(h.computed_score) }))

  return (
    <div className="flex max-w-2xl flex-col items-center gap-6">
      <h1 className="self-start font-display text-2xl font-bold text-earth-900">Your Reliability Score</h1>

      <TrustScoreRing score={Number(latest.computed_score)} size="lg" />

      <div className="flex w-full flex-col gap-4 rounded-md bg-white p-4 shadow-sm">
        <MetricBar label="Payment Reliability" value={Number(latest.payment_reliability)} />
        <MetricBar label="Order Accuracy" value={Number(latest.order_accuracy)} />
        <MetricBar label="Cancellation Rate" value={Number(latest.cancellation_rate)} inverted />
        <MetricBar label="Dispute Rate" value={Number(latest.dispute_rate)} inverted />
      </div>

      {chartData.length > 1 && (
        <div className="h-[200px] w-full rounded-md bg-white p-3 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#1B4332" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
