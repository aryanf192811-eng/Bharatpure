import { RadialBar, RadialBarChart } from 'recharts'

interface TrustScoreRingProps {
  score: number
  size?: 'md' | 'lg'
}

const SIZES = {
  md: { box: 96, inner: 32, outer: 44, text: 'text-xl' },
  lg: { box: 160, inner: 56, outer: 76, text: 'text-4xl' },
}

export function TrustScoreRing({ score, size = 'md' }: TrustScoreRingProps) {
  const dims = SIZES[size]
  const data = [{ name: 'score', value: score, fill: '#1B4332' }]

  return (
    <div className="relative" style={{ width: dims.box, height: dims.box }}>
      <RadialBarChart
        width={dims.box}
        height={dims.box}
        cx="50%"
        cy="50%"
        innerRadius={dims.inner}
        outerRadius={dims.outer}
        barSize={10}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar dataKey="value" cornerRadius={999} background={{ fill: '#F5F0E8' }} max={100} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display font-bold text-primary-800 ${dims.text}`}>{score.toFixed(1)}</span>
        <span className="text-xs text-earth-500">/ 100</span>
      </div>
    </div>
  )
}
