interface IEIMetricProps {
  label: string
  before: string
  after: string
  delta: string
}

// Delta always renders in success green -- in every documented IEI row the change (however its
// sign reads) represents an improvement (e.g. "-15%" consumer price, "-80%" settlement time are
// both wins), so the sign itself carries no color meaning here; the caller chooses the label.
export function IEIMetric({ label, before, after, delta }: IEIMetricProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-earth-200 py-3 last:border-b-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-earth-500">{label}</p>
      <div className="flex items-baseline gap-3">
        <span className="text-sm text-earth-500 line-through decoration-earth-300">{before}</span>
        <span className="font-display text-lg font-bold text-earth-900">{after}</span>
        <span className="text-sm font-semibold text-success">{delta}</span>
      </div>
    </div>
  )
}
