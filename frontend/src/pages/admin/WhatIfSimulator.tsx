import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { simulationApi } from '@/api/simulation.api'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export default function WhatIfSimulator() {
  const [crop, setCrop] = useState('TURMERIC')
  const [city, setCity] = useState('Delhi')
  const [demandSpike, setDemandSpike] = useState(0)
  const [supplyDisruption, setSupplyDisruption] = useState(0)

  const { data: history } = useQuery({ queryKey: ['simulation', 'history'], queryFn: () => simulationApi.history({ limit: 5 }) })

  const runMutation = useMutation({
    mutationFn: () => simulationApi.run({ crop_type: crop, city, demand_spike_pct: demandSpike, supply_disruption_pct: supplyDisruption }),
    onError: () => toast.error('Simulation failed.'),
  })

  const result = runMutation.data?.data

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5 rounded-md bg-white p-5 shadow-sm">
        <div>
          <h1 className="font-display text-2xl font-bold text-earth-900">Scenario Simulator</h1>
          <p className="mt-1 text-sm text-earth-700">Adjust parameters to see how the Decision Engine responds.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className="rounded border border-earth-200 px-3 py-1.5 text-sm">
            {['TURMERIC', 'MUSTARD', 'HONEY'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded border border-earth-200 px-3 py-1.5 text-sm">
            {['Delhi', 'Mumbai', 'Ahmedabad'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium text-earth-900">Demand spike: +{demandSpike}%</p>
          <Slider className="mt-2" min={0} max={50} step={1} value={[demandSpike]} onValueChange={([v]) => setDemandSpike(v)} />
        </div>
        <div>
          <p className="text-sm font-medium text-earth-900">Supply disruption: -{supplyDisruption}%</p>
          <Slider className="mt-2" min={0} max={40} step={1} value={[supplyDisruption]} onValueChange={([v]) => setSupplyDisruption(v)} />
        </div>

        <Button type="button" size="lg" disabled={runMutation.isPending} onClick={() => runMutation.mutate()}>
          {runMutation.isPending ? 'Running...' : 'Run Simulation'}
        </Button>

        {history && history.data.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-earth-900">Run history</p>
            <div className="flex flex-col gap-1">
              {history.data.map((h, i) => (
                <div key={i} className="rounded bg-earth-50 p-2 text-xs text-earth-700">
                  Shortage: {h.shortage_kg} kg &middot; {h.run_duration_ms}ms
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md bg-primary-50 p-5">
        {!result ? (
          <p className="text-sm text-earth-500">Run a simulation to see results.</p>
        ) : (
          <div className="flex animate-in flex-col gap-4">
            <p className={`font-display text-2xl font-bold ${result.shortage_kg > 0 ? 'text-danger' : 'text-success'}`}>
              {result.shortage_kg > 0 ? `Predicted shortage: ${result.shortage_kg} kg` : 'No shortage predicted'}
            </p>
            <div className="flex flex-col gap-2">
              {result.recommended_actions.map((action, i) => (
                <div key={i} className="rounded-md bg-white p-3 text-sm shadow-sm">
                  {JSON.stringify(action)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded bg-white p-3">
                <p className="text-xs text-earth-500">Farmer realization change</p>
                <p className={`text-lg font-bold ${result.farmer_realization_change_pct >= 0 ? 'text-success' : 'text-danger'}`}>
                  {result.farmer_realization_change_pct}%
                </p>
              </div>
              <div className="rounded bg-white p-3">
                <p className="text-xs text-earth-500">Logistics cost change</p>
                <p className={`text-lg font-bold ${result.logistics_cost_change_pct <= 0 ? 'text-success' : 'text-danger'}`}>
                  {result.logistics_cost_change_pct}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
