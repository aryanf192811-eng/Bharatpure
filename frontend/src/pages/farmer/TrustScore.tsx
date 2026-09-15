import { useQuery } from '@tanstack/react-query'

import { farmerApi } from '@/api/farmer.api'
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

export default function TrustScore() {
  const { data, isLoading } = useQuery({ queryKey: ['farmer', 'trust-score'], queryFn: farmerApi.trustScore })

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[480px] p-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const t = data.data

  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-6 p-4">
      <h1 className="self-start font-display text-2xl font-bold tracking-tight text-earth-900">Your Trust Score</h1>

      <TrustScoreRing score={Number(t.computed_score)} size="lg" />

      <div className="flex w-full flex-col gap-4 rounded-md bg-white p-4 shadow-sm">
        <MetricBar label="Fulfillment Rate" value={Number(t.fulfillment_rate)} />
        <MetricBar label="Quality Consistency" value={Number(t.quality_consistency)} />
        <MetricBar label="On-time Delivery" value={Number(t.on_time_delivery_rate)} />
        <MetricBar label="Dispute Rate" value={Number(t.dispute_rate)} inverted />
        <div className="flex items-center justify-between text-sm">
          <span className="text-earth-700">Buyer Rating</span>
          <span className="font-semibold text-earth-900">{Number(t.buyer_rating_avg).toFixed(1)} / 5</span>
        </div>
      </div>

      <p className="text-center text-xs text-earth-500">
        Based on {t.total_batches} batches &middot; last computed {new Date(t.computed_at).toLocaleString('en-IN')}
      </p>
    </div>
  )
}
