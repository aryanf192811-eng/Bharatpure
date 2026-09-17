import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Award,
  ChevronRight,
  FileText,
  Flame,
  Lock,
  Minus,
  PackagePlus,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { farmerApi } from '@/api/farmer.api'
import { BatchStatusPill } from '@/components/shared/BatchStatusPill'
import { TrustScoreRing } from '@/components/shared/TrustScoreRing'
import { Skeleton } from '@/components/ui/skeleton'
import { computeBadges, computeVisibleStreak, getFarmerTier, getNextTierMilestone, TIER_LABELS } from '@/lib/gamification'
import { HERO_IMAGES } from '@/lib/cropImagery'
import type { BatchStatus } from '@/types/batch.types'

const formatRupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function FarmerDashboard() {
  const { data: profile } = useQuery({ queryKey: ['farmer', 'profile'], queryFn: farmerApi.profile })
  const { data: dashboard, isLoading } = useQuery({ queryKey: ['farmer', 'dashboard'], queryFn: farmerApi.dashboard })
  // 404s until the nightly trust-score job has run at least once -- the gamification block below
  // degrades to trust_score alone (still real, from the dashboard payload) when this is absent.
  const { data: trustRes } = useQuery({ queryKey: ['farmer', 'trust-score'], queryFn: farmerApi.trustScore, retry: false })

  if (isLoading || !dashboard) {
    return (
      <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  const d = dashboard.data
  const fpoName = (profile?.data.fpo_name as string | undefined) ?? ''

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">Namaste</p>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-earth-900">Welcome back 🌾</h1>
          {fpoName && <p className="mt-0.5 text-xs text-earth-700">{fpoName}</p>}
        </div>
        <div className="relative size-14 shrink-0 overflow-hidden rounded-md shadow-sm">
          <img src={HERO_IMAGES.turmericField} alt="Your farm" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900/40 to-transparent" />
        </div>
      </div>

      {/* Gamified trust tier */}
      {d.trust_score !== null && (() => {
        const score = d.trust_score
        const tier = getFarmerTier(score)
        const milestone = getNextTierMilestone(score)
        const streak = computeVisibleStreak(d.recent_batches)
        const badges = computeBadges(trustRes?.data, d)
        const unlockedCount = badges.filter((b) => b.unlocked).length

        return (
          <div className="flex flex-col gap-4 rounded-lg border border-gold-400/40 bg-gradient-to-br from-gold-50 via-white to-primary-50 p-4 shadow-lg">
            <div className="flex items-center gap-4">
              <TrustScoreRing score={score} />
              <div className="flex flex-1 flex-col gap-1">
                <span className="w-fit rounded-full border border-gold-400 bg-gold-100 px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-gold-800 shadow-sm">
                  {TIER_LABELS[tier]}
                </span>
                {milestone ? (
                  <p className="text-xs leading-snug text-earth-700">
                    <span className="font-semibold text-earth-900">{milestone.pointsToGo.toFixed(0)} more trust points</span> to{' '}
                    {TIER_LABELS[milestone.nextTier]}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-primary-700">Top tier reached — Platinum FPO</p>
                )}
                <Link
                  to="/farmer/trust-score"
                  className="mt-1 flex w-fit items-center gap-0.5 font-mono text-xs font-medium uppercase tracking-wider text-primary-800 hover:text-primary-700"
                >
                  Full breakdown <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {streak > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-gold-400/60 bg-gold-100 px-3 py-2 shadow-sm">
                <Flame className="size-4 shrink-0 text-terracotta-600" />
                <p className="text-xs font-semibold text-earth-900">
                  {streak} batch{streak === 1 ? '' : 'es'} in a row passed quality — keep it going
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  title={badge.description}
                  className={`flex items-center gap-2 rounded-md p-2 shadow-sm ${
                    badge.unlocked ? 'border border-gold-400/60 bg-white' : 'border border-earth-200 bg-earth-100'
                  }`}
                >
                  {badge.unlocked ? (
                    <Award className="size-4 shrink-0 text-gold-600" />
                  ) : (
                    <Lock className="size-4 shrink-0 text-earth-400" />
                  )}
                  <span className={`text-xs font-medium leading-tight ${badge.unlocked ? 'text-earth-900' : 'text-earth-500'}`}>
                    {badge.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-center font-mono text-xs uppercase tracking-wider text-earth-500">
              {unlockedCount} of {badges.length} achievements unlocked
            </p>
          </div>
        )
      })()}

      {/* Demand signals */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-body text-lg font-semibold text-earth-900">Live Demand Signals</h2>
          <span className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">AI Forecast</span>
        </div>
        {d.demand_signals.length === 0 ? (
          <p className="rounded-md bg-white p-3 text-sm text-earth-500 shadow-sm">No demand data yet for your crops.</p>
        ) : (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {d.demand_signals.map((signal) => (
              <div key={`${signal.crop_type}-${signal.city}`} className="flex w-[220px] shrink-0 flex-col gap-2 rounded-md bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-bold text-earth-900">{signal.crop_type}</span>
                  <span className="rounded-sm bg-earth-100 px-1.5 py-0.5 font-mono text-xs font-medium uppercase tracking-wider text-earth-500">
                    {signal.city}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {signal.demand_delta_pct === 0 ? (
                    <Minus className="size-4 text-earth-500" />
                  ) : (
                    <TrendingUp className={`size-4 ${signal.demand_delta_pct > 0 ? 'text-primary-500' : 'text-danger'}`} />
                  )}
                  <span className="text-sm font-bold text-primary-700">
                    {signal.demand_delta_pct > 0 ? '+' : ''}
                    {signal.demand_delta_pct}% demand
                  </span>
                </div>
                <span className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">
                  {signal.confidence_pct}% confidence
                </span>
                {(() => {
                  const advisory = d.crop_advisories.find((a) => a.crop_type === signal.crop_type)
                  if (!advisory || advisory.recommendation === 'MAINTAIN') return null
                  const isIncrease = advisory.recommendation === 'INCREASE'
                  return (
                    <span
                      title={advisory.rationale}
                      className={`mt-1 w-fit rounded-sm px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${
                        isIncrease ? 'bg-success-bg text-success' : 'bg-gold-50 text-gold-800'
                      }`}
                    >
                      {isIncrease ? 'Grow more next season' : 'Grow less next season'}
                    </span>
                  )
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/farmer/batches/new/step-1"
          className="col-span-1 flex h-28 flex-col justify-between rounded-md bg-primary-800 p-3 text-left text-white shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
        >
          <div className="flex size-8 items-center justify-center rounded bg-white/10">
            <PackagePlus className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">New Harvest Batch</p>
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-white/70">Register lot</p>
          </div>
        </Link>
        <Link
          to="/farmer/batches"
          className="col-span-1 flex h-28 flex-col justify-between rounded-md bg-white p-3 text-left text-earth-900 shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-8 items-center justify-center rounded bg-earth-100 text-primary-800">
              <PackagePlus className="size-5" />
            </div>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-primary-800">
              {d.active_batches}
            </span>
          </div>
          <p className="text-sm font-bold leading-tight">All Batches</p>
        </Link>
        <Link
          to="/farmer/contracts"
          className="col-span-1 flex h-28 flex-col justify-between rounded-md bg-white p-3 text-left text-earth-900 shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
        >
          <div className="flex size-8 items-center justify-center rounded bg-earth-100 text-gold-800">
            <FileText className="size-5" />
          </div>
          <p className="text-sm font-bold leading-tight">Contracts</p>
        </Link>
        <Link
          to="/farmer/earnings"
          className="col-span-1 flex h-28 flex-col justify-between rounded-md bg-white p-3 text-left text-earth-900 shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-8 items-center justify-center rounded bg-earth-100 text-primary-700">
              <Wallet className="size-5" />
            </div>
            <ChevronRight className="size-4 text-earth-500" />
          </div>
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">Pending</p>
            <p className="text-lg font-bold leading-tight text-primary-800">{formatRupees(d.pending_payments_paise)}</p>
          </div>
        </Link>
      </div>

      {/* Recent batches */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="font-body text-lg font-semibold text-earth-900">Recent Batches</h2>
            <span className="rounded-full bg-earth-100 px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider text-earth-700">
              {d.active_batches}
            </span>
          </div>
          <Link to="/farmer/batches" className="flex items-center gap-0.5 font-mono text-xs font-medium uppercase tracking-wider text-primary-800 hover:text-primary-700">
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {d.recent_batches.length === 0 ? (
          <p className="rounded-md bg-white p-4 text-center text-sm text-earth-500 shadow-sm">
            No batches yet.{' '}
            <Link to="/farmer/batches/new/step-1" className="font-semibold text-primary-700">
              Create your first batch
            </Link>
          </p>
        ) : (
          d.recent_batches.slice(0, 3).map((batch) => (
            <Link
              key={batch.id}
              to={`/farmer/batches/${batch.id}`}
              className="flex flex-col gap-2 rounded-md bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-sm bg-earth-100 px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wide text-earth-700">
                  {batch.batch_code}
                </span>
                <BatchStatusPill status={batch.status as BatchStatus} />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-earth-900">{batch.crop_type}</h3>
                  <p className="text-xs text-earth-700">
                    Quantity: <span className="font-medium text-earth-900">{batch.total_quantity_kg} kg</span>
                  </p>
                </div>
                {batch.quality_score && (
                  <div className="text-right">
                    <span className="font-display text-xl font-bold leading-none text-primary-800">{batch.quality_score}</span>
                    <p className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">/100</p>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Earnings summary */}
      <div className="flex flex-col gap-4 rounded-md bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">Net Realization</p>
            <p className="mt-0.5 font-display text-3xl font-bold text-primary-800">{formatRupees(d.total_earned_paise)}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-gold-50 text-gold-800 shadow-sm">
            <Wallet className="size-5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded bg-earth-100 p-2">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">Pending (Escrow)</p>
            <p className="mt-0.5 text-lg font-semibold text-earth-900">{formatRupees(d.pending_payments_paise)}</p>
          </div>
          <div className="rounded bg-earth-100 p-2">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-earth-500">Total Earned</p>
            <p className="mt-0.5 text-lg font-semibold text-earth-900">{formatRupees(d.total_earned_paise)}</p>
          </div>
        </div>
        <Link
          to="/farmer/earnings"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-earth-100 py-3 text-sm font-semibold text-earth-900 transition-colors hover:bg-earth-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
        >
          View Full Earnings &amp; Statements
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
