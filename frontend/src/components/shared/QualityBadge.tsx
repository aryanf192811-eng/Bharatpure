interface QualityBadgeProps {
  score: number
  tier: 'NABL' | 'Rapid'
}

export function QualityBadge({ score, tier }: QualityBadgeProps) {
  const tone =
    score >= 90
      ? 'bg-success-bg text-success'
      : score >= 70
        ? 'bg-warning-bg text-warning'
        : 'bg-danger-bg text-danger'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${tone}`}>
      {score}/100 {tier}
    </span>
  )
}
