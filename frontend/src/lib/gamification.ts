import type { FarmerDashboard, FarmerTrustScore } from '@/api/farmer.api'

export type FarmerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'

// Tier cutoffs deliberately reuse the exact thresholds trust-score.job.js already uses for
// credit eligibility bands (75 = HIGH, 50 = MEDIUM) rather than inventing new ones -- "Gold"
// here means the same real thing "High Eligibility" means on the credit screen, not a separate
// made-up scale. Platinum is a step above HIGH so it stays a genuine stretch goal.
const TIER_THRESHOLDS: Array<{ tier: FarmerTier; min: number }> = [
  { tier: 'PLATINUM', min: 90 },
  { tier: 'GOLD', min: 75 },
  { tier: 'SILVER', min: 50 },
  { tier: 'BRONZE', min: 0 },
]

const TIER_ORDER: FarmerTier[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']

export const TIER_LABELS: Record<FarmerTier, string> = {
  BRONZE: 'Bronze FPO',
  SILVER: 'Silver FPO',
  GOLD: 'Gold FPO',
  PLATINUM: 'Platinum FPO',
}

export function getFarmerTier(trustScore: number): FarmerTier {
  return TIER_THRESHOLDS.find((t) => trustScore >= t.min)!.tier
}

export function getNextTierMilestone(trustScore: number): { nextTier: FarmerTier; pointsToGo: number } | null {
  const currentIndex = TIER_ORDER.indexOf(getFarmerTier(trustScore))
  if (currentIndex === TIER_ORDER.length - 1) return null
  const nextTier = TIER_ORDER[currentIndex + 1]
  const nextThreshold = TIER_THRESHOLDS.find((t) => t.tier === nextTier)!.min
  return { nextTier, pointsToGo: Math.max(0, Math.ceil(nextThreshold - trustScore)) }
}

// Same passing threshold price.service.js's QUALITY_BANDS.STANDARD already uses to decide
// whether a batch counts as "standard grade or better" -- reused here so a streak means the same
// thing it means everywhere else quality_score is judged, not a separate invented cutoff.
const QUALITY_PASS_THRESHOLD = 70

/**
 * "Streak" is deliberately scoped to what's actually fetched (dashboard's recent_batches, capped
 * at 5 server-side) rather than a full-history count -- there's no dedicated streak field in the
 * schema, and inflating this from data we don't have would be exactly the kind of overclaim this
 * project has been careful to avoid elsewhere. Counts consecutive passing batches starting from
 * the most recent (recent_batches is already ordered created_at DESC).
 */
export function computeVisibleStreak(recentBatches: Array<{ quality_score: string | null }>): number {
  let streak = 0
  for (const b of recentBatches) {
    if (b.quality_score !== null && Number(b.quality_score) >= QUALITY_PASS_THRESHOLD) streak++
    else break
  }
  return streak
}

export interface Badge {
  id: string
  label: string
  description: string
  unlocked: boolean
}

/** Every flag here reads an existing real field -- no new backend metric invented for this. */
export function computeBadges(trust: FarmerTrustScore | undefined, dashboard: FarmerDashboard): Badge[] {
  const totalBatches = trust?.total_batches ?? 0
  const disputeRate = trust ? Number(trust.dispute_rate) : null
  const qualityConsistency = trust ? Number(trust.quality_consistency) : null
  const batchTarget = 10

  return [
    {
      id: 'first_batch',
      label: 'First Batch Sold',
      description: 'Completed your first sale on BharatPure',
      unlocked: dashboard.total_earned_paise > 0,
    },
    {
      id: 'zero_disputes',
      label: 'Zero Disputes',
      description: 'No buyer disputes on record',
      unlocked: disputeRate !== null && disputeRate === 0,
    },
    {
      id: 'quality_consistent',
      label: 'Quality Consistent',
      description: '90%+ quality consistency across your batches',
      unlocked: qualityConsistency !== null && qualityConsistency >= 90,
    },
    {
      id: 'ten_batches',
      label: `${batchTarget} Batches Shipped`,
      description: `${Math.min(totalBatches, batchTarget)} of ${batchTarget} batches`,
      unlocked: totalBatches >= batchTarget,
    },
  ]
}
