import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { demandApi } from '@/api/demand.api'
import { Skeleton } from '@/components/ui/skeleton'

const CROPS = ['TURMERIC', 'MUSTARD', 'HONEY']
const CITIES = ['Delhi', 'Mumbai', 'Ahmedabad']

export default function DemandIntelligence() {
  const [crop, setCrop] = useState('TURMERIC')
  const [city, setCity] = useState('Delhi')

  const { data, isLoading } = useQuery({
    queryKey: ['demand', 'forecast', crop, city],
    queryFn: () => demandApi.forecast({ crop_type: crop, city, days: 30 }),
  })

  const rows = data?.data.forecast ?? []
  const chartData = rows.map((r) => ({
    date: new Date(r.forecast_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    predicted: r.predicted_kg,
    range: [r.range_low_kg, r.range_high_kg],
  }))
  const latestDrivers = rows[0]?.demand_drivers ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-earth-900">Demand Intelligence</h1>
        {data?.data.stale && (
          <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">Stale cache</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md bg-white p-3 shadow-sm">
        <select value={crop} onChange={(e) => setCrop(e.target.value)} className="rounded border border-earth-200 px-3 py-1.5 text-sm">
          {CROPS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded border border-earth-200 px-3 py-1.5 text-sm">
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : chartData.length === 0 ? (
        <p className="rounded-md bg-white p-8 text-center text-sm text-earth-500 shadow-sm">No forecast data for this crop/city yet.</p>
      ) : (
        <>
          <div className="h-[350px] rounded-md bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2D9CC" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area dataKey="range" stroke="none" fill="#D8F3DC" name="Confidence band" />
                <Line type="monotone" dataKey="predicted" stroke="#1B4332" strokeWidth={2} dot={false} name="Predicted (kg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {latestDrivers.length > 0 && (
            <div className="rounded-md bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-earth-900">Demand Drivers</p>
              <div className="flex flex-col gap-2">
                {latestDrivers.map((driver) => (
                  <div key={driver.factor} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs text-earth-700">{driver.factor.replace(/_/g, ' ')}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-earth-100">
                      <div className="h-full rounded-full bg-primary-600" style={{ width: `${driver.contribution_pct}%` }} />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold text-earth-900">{driver.contribution_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
