interface PriceRecommendationCardProps {
  low: number // paise
  high: number // paise
  commodity: number // paise
  premium: number // pct
}

const formatRupees = (paise: number) => `₹${Math.round(paise / 100)}`

export function PriceRecommendationCard({ low, high, commodity, premium }: PriceRecommendationCardProps) {
  return (
    <div className="rounded-md border border-gold-400 bg-gold-100 p-4">
      <p className="text-sm font-semibold text-earth-900">
        BharatPure Recommended: {formatRupees(low)} &ndash; {formatRupees(high)} per kg
      </p>
      <p className="mt-1 text-sm text-earth-700">Commodity rate (eNAM): {formatRupees(commodity)}/kg</p>
      <p className="mt-1 text-sm font-semibold text-success">Your premium: +{premium}%</p>
      <p className="mt-2 text-xs text-earth-500">Based on quality estimate and destination-city demand.</p>
    </div>
  )
}
