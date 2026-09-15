import { useQuery } from '@tanstack/react-query'
import { Landmark } from 'lucide-react'

import { farmerApi } from '@/api/farmer.api'
import { TrustScoreRing } from '@/components/shared/TrustScoreRing'
import { Skeleton } from '@/components/ui/skeleton'

const BAND_STYLES: Record<string, string> = {
  HIGH: 'bg-success-bg text-success',
  MEDIUM: 'bg-gold-50 text-gold-800',
  LOW: 'bg-danger-bg text-danger',
  INSUFFICIENT_DATA: 'bg-earth-100 text-earth-500',
}
const BAND_LABELS: Record<string, string> = {
  HIGH: 'High Eligibility',
  MEDIUM: 'Medium Eligibility',
  LOW: 'Low Eligibility',
  INSUFFICIENT_DATA: 'Not Enough History Yet',
}

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
  // 404s until the nightly job has run at least once for this FPO -- not worth retrying, a
  // missing credit score just means the card below doesn't render.
  const { data: creditRes } = useQuery({
    queryKey: ['farmer', 'credit-eligibility'],
    queryFn: farmerApi.creditEligibility,
    retry: false,
  })

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

      {creditRes?.data && (
        <div className="flex w-full flex-col gap-3 rounded-md bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-earth-900">
              <Landmark className="size-4 text-primary-700" /> Micro-Credit Eligibility
            </p>
            <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${BAND_STYLES[creditRes.data.latest.eligibility_band]}`}>
              {BAND_LABELS[creditRes.data.latest.eligibility_band]}
            </span>
          </div>
          {creditRes.data.latest.eligibility_band !== 'INSUFFICIENT_DATA' && (
            <>
              <MetricBar label="Trust Score" value={Number(creditRes.data.latest.trust_score_component)} />
              <MetricBar label="Payment Reliability" value={Number(creditRes.data.latest.repayment_proxy_component)} />
              <MetricBar label="Batch Volume" value={Number(creditRes.data.latest.batch_volume_component)} />
            </>
          )}
          <p className="text-xs text-earth-500">
            An indicative signal for lending partners, based on your trust score and transaction history &mdash; not a loan offer.
          </p>
        </div>
      )}
    </div>
  )
}
