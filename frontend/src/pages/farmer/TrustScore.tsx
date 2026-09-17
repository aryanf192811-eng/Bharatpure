import { useQuery } from '@tanstack/react-query'
import { Landmark } from 'lucide-react'

import { farmerApi } from '@/api/farmer.api'
import { TrustScoreRing } from '@/components/shared/TrustScoreRing'
import { Skeleton } from '@/components/ui/skeleton'
import { getFarmerTier, getNextTierMilestone, TIER_LABELS } from '@/lib/gamification'

// Real weights from trust-score.job.js's credit-score formula (0.40/0.30/0.20/0.10) -- shown
// verbatim rather than as a vague "your score is based on several factors" line, matching this
// page's existing "no hidden criteria" honesty.
const CREDIT_WEIGHTS = {
  trust: 40,
  repayment: 30,
  volume: 20,
  disputes: 10,
}

// Same HIGH/MEDIUM cutoffs trust-score.job.js uses (75/50) -- not a separate invented scale.
const nextCreditBandMilestone = (score: number, band: string): { label: string; pointsToGo: number } | null => {
  if (band === 'HIGH') return null
  if (band === 'MEDIUM') return { label: 'High Eligibility', pointsToGo: Math.max(0, Math.ceil(75 - score)) }
  return { label: 'Medium Eligibility', pointsToGo: Math.max(0, Math.ceil(50 - score)) }
}

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

function MetricBar({
  label,
  value,
  inverted = false,
  weightPct,
}: {
  label: string
  value: number
  inverted?: boolean
  weightPct?: number
}) {
  const good = inverted ? value <= 20 : value >= 70
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-earth-700">
          {label}
          {weightPct !== undefined && (
            <span className="ml-1 font-mono text-xs text-earth-400">(Wt: {weightPct}%)</span>
          )}
        </span>
        <span className={`font-mono font-semibold ${good ? 'text-success' : 'text-earth-900'}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-earth-100 shadow-inner">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${good ? 'from-primary-500 to-primary-700' : 'from-primary-700 to-primary-800'}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
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
  const score = Number(t.computed_score)
  const tier = getFarmerTier(score)
  const milestone = getNextTierMilestone(score)

  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-6 p-4">
      <h1 className="self-start font-display text-2xl font-bold tracking-tight text-earth-900">Your Trust Score</h1>

      <div className="flex w-full flex-col items-center gap-3 rounded-lg border border-gold-400/40 bg-gradient-to-br from-gold-50 via-white to-primary-50 p-6 shadow-lg">
        <TrustScoreRing score={score} size="lg" />
        <span className="w-fit rounded-full border border-gold-400 bg-gold-100 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-gold-800 shadow-sm">
          {TIER_LABELS[tier]}
        </span>
        {milestone ? (
          <p className="rounded-full bg-white/70 px-3 py-1 text-xs text-earth-700 shadow-sm">
            <span className="font-semibold text-earth-900">{milestone.pointsToGo.toFixed(0)} more points</span> to {TIER_LABELS[milestone.nextTier]}
          </p>
        ) : (
          <p className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-primary-700 shadow-sm">Top tier reached — Platinum FPO</p>
        )}
      </div>

      <div className="flex w-full flex-col gap-4 rounded-md border border-border bg-white p-4 shadow-md">
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
              <MetricBar label="Trust Score" value={Number(creditRes.data.latest.trust_score_component)} weightPct={CREDIT_WEIGHTS.trust} />
              <MetricBar label="Payment Reliability" value={Number(creditRes.data.latest.repayment_proxy_component)} weightPct={CREDIT_WEIGHTS.repayment} />
              <MetricBar label="Batch Volume" value={Number(creditRes.data.latest.batch_volume_component)} weightPct={CREDIT_WEIGHTS.volume} />
              <MetricBar label="Dispute-Free Record" value={Number(creditRes.data.latest.dispute_penalty_component)} weightPct={CREDIT_WEIGHTS.disputes} />
              {(() => {
                const next = nextCreditBandMilestone(Number(creditRes.data.latest.computed_score), creditRes.data.latest.eligibility_band)
                if (!next) return <p className="text-xs font-semibold text-primary-700">Top eligibility band reached.</p>
                return (
                  <p className="text-xs text-earth-700">
                    <span className="font-semibold text-earth-900">{next.pointsToGo.toFixed(0)} more points</span> to {next.label}
                  </p>
                )
              })()}
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
