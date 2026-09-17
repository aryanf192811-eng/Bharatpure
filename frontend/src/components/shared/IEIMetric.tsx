interface IEIMetricProps {
  label: string
  before: string
  after: string
  delta: string
}

// Delta always renders in success green -- in every documented IEI row the change (however its
// sign reads) represents an improvement (e.g. "-15%" consumer price, "-80%" settlement time are
// both wins), so the sign itself carries no color meaning here; the caller chooses the label.
// Both "before" and "delta" are skipped when empty -- a caller passing an empty string for either
// signals "no real comparison to show" (e.g. the metric itself has no data yet), and pairing a
// struck-through baseline or a "-distance" delta next to "Not enough data yet" would read as a
// contradiction, not a real computed improvement.
export function IEIMetric({ label, before, after, delta }: IEIMetricProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-earth-200 py-3 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-earth-500">{label}</p>
      <div className="flex items-baseline gap-3">
        {before && <span className="text-sm text-earth-500 line-through decoration-earth-300">{before}</span>}
        <span className="font-display text-lg font-bold text-earth-900">{after}</span>
        {delta && <span className="text-sm font-semibold text-success">{delta}</span>}
      </div>
    </div>
  )
}
