import { TrendingDown, TrendingUp } from 'lucide-react'

interface DemandSignalProps {
  crop: string
  city: string
  delta: number
  confidence: number
}

export function DemandSignal({ crop, city, delta, confidence }: DemandSignalProps) {
  const isPositive = delta >= 0

  return (
    <div className="flex min-w-[200px] flex-col gap-2 rounded border border-earth-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="font-body text-sm font-semibold text-earth-900">
        {crop} <span className="font-normal text-earth-500">&middot; {city}</span>
      </p>
      <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>
        {isPositive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
        <span>
          {isPositive ? '+' : ''}
          {delta}% demand
        </span>
      </div>
      <p className="text-xs text-earth-500">{confidence}% confidence</p>
    </div>
  )
}
