import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { priceApi } from '@/api/price.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const CROPS = ['TURMERIC', 'MUSTARD', 'HONEY']

export default function PriceIntelligence() {
  const [crop, setCrop] = useState('TURMERIC')
  const [calc, setCalc] = useState({ quality_score: 90, quantity_kg: 100, city: 'Delhi' })

  const { data: rates, isLoading } = useQuery({ queryKey: ['price', 'rates', crop], queryFn: () => priceApi.marketRates({ crop_type: crop }) })
  const { data: recommendation } = useQuery({
    queryKey: ['price', 'recommendation', crop, calc.city],
    queryFn: () => priceApi.recommendation({ crop_type: crop, quality_score: calc.quality_score, city: calc.city }),
  })
  const { data: premium, refetch } = useQuery({
    queryKey: ['price', 'premium', crop, calc],
    queryFn: () => priceApi.premiumCalculator({ crop_type: crop, quality_score: calc.quality_score, quantity_kg: calc.quantity_kg, destination_city: calc.city }),
    enabled: false,
  })

  const chartData = (rates?.data.history ?? []).map((p) => ({
    date: new Date(p.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    price: p.price_paise / 100,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-earth-900">Price Intelligence</h1>
        <select value={crop} onChange={(e) => setCrop(e.target.value)} className="rounded border border-earth-200 px-3 py-1.5 text-sm">
          {CROPS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="h-[300px] rounded-md bg-white p-4 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2D9CC" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => `₹${v}`} />
              <Line type="monotone" dataKey="price" stroke="#9B8B72" strokeWidth={2} dot={false} name="eNAM commodity ₹/kg" />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-xs text-earth-500">30-day eNAM commodity price for {crop}</p>
        </div>
      )}

      {recommendation && (
        <div className="overflow-x-auto rounded-md bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
                <th className="p-3">Crop</th>
                <th className="p-3">Quality Band</th>
                <th className="p-3">City</th>
                <th className="p-3">Commodity Rate</th>
                <th className="p-3">Recommended Range</th>
                <th className="p-3">Premium</th>
                <th className="p-3">Buyer Acceptance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3">{recommendation.data.crop_type}</td>
                <td className="p-3">{recommendation.data.quality_score_band}</td>
                <td className="p-3">{recommendation.data.destination_city}</td>
                <td className="p-3">₹{(recommendation.data.commodity_price_paise / 100).toFixed(0)}/kg</td>
                <td className="p-3">
                  ₹{(recommendation.data.recommended_low_paise / 100).toFixed(0)}&ndash;₹{(recommendation.data.recommended_high_paise / 100).toFixed(0)}/kg
                </td>
                <td className="p-3 font-semibold text-success">+{recommendation.data.premium_pct}%</td>
                <td className="p-3">{recommendation.data.buyer_acceptance_prob}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-earth-900">Premium Calculator</p>
        <div className="grid grid-cols-3 gap-3">
          <Input
            type="number"
            placeholder="Quality score"
            value={calc.quality_score}
            onChange={(e) => setCalc({ ...calc, quality_score: Number(e.target.value) })}
          />
          <Input
            type="number"
            placeholder="Quantity (kg)"
            value={calc.quantity_kg}
            onChange={(e) => setCalc({ ...calc, quantity_kg: Number(e.target.value) })}
          />
          <Input placeholder="City" value={calc.city} onChange={(e) => setCalc({ ...calc, city: e.target.value })} />
        </div>
        <Button type="button" className="mt-3" onClick={() => refetch()}>
          Calculate
        </Button>
        {premium && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded bg-earth-100 p-3">
              <p className="text-xs text-earth-500">At Commodity Rate</p>
              <p className="text-lg font-bold text-earth-900">₹{(premium.data.at_commodity_rate_paise / 100).toFixed(0)}</p>
            </div>
            <div className="rounded bg-success-bg p-3">
              <p className="text-xs text-earth-700">At BharatPure Rate</p>
              <p className="text-lg font-bold text-success">₹{(premium.data.at_recommended_rate_paise / 100).toFixed(0)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
