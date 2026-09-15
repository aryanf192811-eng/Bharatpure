import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Thermometer } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { logisticsApi } from '@/api/logistics.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TemperatureLogEntry() {
  const [batchId, setBatchId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [temperature, setTemperature] = useState('')
  const [threshold, setThreshold] = useState('8.0')
  const [breach, setBreach] = useState<boolean | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      logisticsApi.logTemperature({
        batch_id: batchId,
        vehicle_id: vehicleId,
        temperature_c: Number(temperature),
        threshold_c: Number(threshold),
      }),
    onSuccess: (res) => {
      setBreach(res.data.breach_detected)
      if (res.data.breach_detected) {
        toast.warning('Temperature breach logged and flagged for review.')
      } else {
        toast.success('Reading logged.')
      }
    },
    onError: () => toast.error('Could not log reading. Check the batch ID.'),
  })

  const tempNum = Number(temperature)
  const thresholdNum = Number(threshold)
  const isOverThreshold = temperature !== '' && tempNum > thresholdNum

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
      <h1 className="font-display text-2xl font-bold text-earth-900">Log Temperature Reading</h1>

      <div className="flex flex-col gap-4 rounded-md bg-white p-4 shadow-sm">
        <div>
          <Label htmlFor="batch">Batch ID</Label>
          <Input id="batch" placeholder="Batch UUID from your route" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="vehicle">Vehicle ID</Label>
          <Input id="vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="threshold">Safe threshold (&deg;C)</Label>
          <Input id="threshold" type="number" step={0.1} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="temp">Temperature Reading (&deg;C)</Label>
          <div className="relative mt-1.5">
            <Thermometer className={`absolute left-3 top-1/2 size-5 -translate-y-1/2 ${isOverThreshold ? 'text-danger' : 'text-success'}`} />
            <Input
              id="temp"
              type="number"
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className={`pl-10 text-lg font-bold ${isOverThreshold ? 'border-danger text-danger' : 'border-success text-success'}`}
            />
          </div>
        </div>
      </div>

      <Button type="button" size="lg" disabled={!batchId || !vehicleId || !temperature || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? 'Logging...' : 'Log Reading'}
      </Button>

      {breach === true && (
        <div className="flex items-center gap-2 rounded-md bg-danger-bg p-3 text-sm text-danger">
          <AlertTriangle className="size-5" />
          Temperature breach detected and logged. Ops team notified.
        </div>
      )}
    </div>
  )
}
