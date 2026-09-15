import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface TemperatureStatusBadgeProps {
  maintained: boolean
  maxTemp: number
  threshold: number
}

export function TemperatureStatusBadge({ maintained, maxTemp, threshold }: TemperatureStatusBadgeProps) {
  if (maintained) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="size-3.5" />
        Maintained &middot; max {maxTemp}&deg;C
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-1 text-xs font-semibold text-danger">
      <AlertTriangle className="size-3.5" />
      Breach Detected &middot; {maxTemp}&deg;C (limit {threshold}&deg;C)
    </span>
  )
}
