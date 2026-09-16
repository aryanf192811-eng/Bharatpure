import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, MapPin, Snowflake, Thermometer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { logisticsApi } from '@/api/logistics.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TemperatureLogEntry() {
  const [searchParams] = useSearchParams()
  const routeIdFromRoute = searchParams.get('routeId') ?? ''

  const [batchId, setBatchId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [temperature, setTemperature] = useState('')
  const [threshold, setThreshold] = useState('8.0')
  const [breach, setBreach] = useState<boolean | null>(null)
  const [reroute, setReroute] = useState<{ facility_name: string; distance_km: number } | null>(null)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [positionDenied, setPositionDenied] = useState(false)

  // Captured once on mount rather than gated behind a button -- a driver reporting a breach
  // wants this to just happen, not be one more step. Silently no-ops if permission is denied or
  // the browser doesn't support it; the reroute simply can't be computed without a position,
  // same as if this field were never sent at all.
  useEffect(() => {
    if (!navigator.geolocation) {
      setPositionDenied(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPositionDenied(true),
      { timeout: 8000 },
    )
  }, [])

  const mutation = useMutation({
    mutationFn: () =>
      logisticsApi.logTemperature({
        batch_id: batchId,
        route_id: routeIdFromRoute || undefined,
        vehicle_id: vehicleId,
        temperature_c: Number(temperature),
        threshold_c: Number(threshold),
        location_lat: position?.lat,
        location_lng: position?.lng,
      }),
    onSuccess: (res) => {
      setBreach(res.data.breach_detected)
      setReroute(res.data.reroute)
      if (res.data.reroute) {
        toast.warning(`Breach logged. Route updated: drop at ${res.data.reroute.facility_name}.`)
      } else if (res.data.breach_detected) {
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

      {routeIdFromRoute && (
        <p className="flex items-center gap-1.5 text-xs text-earth-500">
          <MapPin className="size-3.5" />
          Logging against your active route. {position ? 'Location captured.' : positionDenied ? 'Location unavailable — reroute suggestion needs it.' : 'Getting your location…'}
        </p>
      )}

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

      {breach === true && reroute && (
        <div className="flex items-start gap-2 rounded-md bg-danger-bg p-3 text-sm text-danger">
          <Snowflake className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">Breach detected — route auto-updated.</p>
            <p>Drop at {reroute.facility_name} ({reroute.distance_km}km away) added as your next stop.</p>
          </div>
        </div>
      )}
      {breach === true && !reroute && (
        <div className="flex items-center gap-2 rounded-md bg-danger-bg p-3 text-sm text-danger">
          <AlertTriangle className="size-5" />
          Temperature breach detected and logged. Ops team notified.
        </div>
      )}
    </div>
  )
}
