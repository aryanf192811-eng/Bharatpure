import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, Sprout, Thermometer, Truck } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { Link, useParams } from 'react-router-dom'

import { orderApi } from '@/api/order.api'
import { IEIMetric } from '@/components/shared/IEIMetric'
import { Skeleton } from '@/components/ui/skeleton'
import { defaultMarkerIcon } from '@/lib/leafletIcons'

const formatRupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`

const STEPS = ['placed', 'confirmed', 'dispatched', 'delivered'] as const

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>()
  const { data: orderRes, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderApi.getById(orderId!),
    enabled: !!orderId,
  })
  const { data: trackRes } = useQuery({
    queryKey: ['order', orderId, 'track'],
    queryFn: () => orderApi.track(orderId!),
    enabled: !!orderId,
  })
  const { data: impactRes } = useQuery({
    queryKey: ['order', orderId, 'impact'],
    queryFn: () => orderApi.getImpact(orderId!),
    enabled: !!orderId && orderRes?.data.status === 'delivered',
  })

  if (isLoading || !orderRes) {
    return (
      <div className="p-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const order = orderRes.data
  const track = trackRes?.data
  const currentStepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number])
  const deliveryLat = order.delivery_address.lat
  const deliveryLng = order.delivery_address.lng

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="text-lg font-bold capitalize text-earth-900">{order.status}</p>
        <p className="text-sm text-earth-500">
          {order.status === 'dispatched' ? 'Your order is on the way' : `Order ${order.status}`}
        </p>
      </div>

      {deliveryLat && deliveryLng && (
        <div className="h-[200px] overflow-hidden rounded-md shadow-sm">
          <MapContainer center={[deliveryLat, deliveryLng]} zoom={12} className="size-full" scrollWheelZoom={false}>
            <TileLayer url={import.meta.env.VITE_MAPS_TILE_URL} attribution="&copy; OpenStreetMap" />
            <Marker position={[deliveryLat, deliveryLng]} icon={defaultMarkerIcon}>
              <Popup>Delivery address</Popup>
            </Marker>
          </MapContainer>
        </div>
      )}

      <div className="flex items-center justify-between rounded-md bg-white p-4 shadow-sm">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 flex-col items-center gap-1">
            {i <= currentStepIndex ? (
              <CheckCircle2 className="size-5 text-primary-800" />
            ) : (
              <Circle className="size-5 text-earth-300" />
            )}
            <span className={`text-xs capitalize ${i <= currentStepIndex ? 'font-semibold text-primary-800' : 'text-earth-500'}`}>
              {step}
            </span>
          </div>
        ))}
      </div>

      {track?.driver_name && (
        <div className="flex items-center gap-3 rounded-md bg-white p-4 shadow-sm">
          <Truck className="size-6 text-primary-700" />
          <div>
            <p className="text-sm font-semibold text-earth-900">{track.driver_name}</p>
            <p className="text-xs text-earth-500">{track.vehicle_id}</p>
          </div>
          {track.temperature_status && (
            <div className="ml-auto flex items-center gap-1 text-xs font-medium text-success">
              <Thermometer className="size-3.5" />
              {track.temperature_status === 'maintained' ? 'Cold chain OK' : 'Breach'}
            </div>
          )}
        </div>
      )}

      <div className="rounded-md bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-earth-900">Items</p>
        {order.items?.map((item) => (
          <div key={item.id} className="flex justify-between text-sm text-earth-700">
            <span>{item.quantity_kg} kg</span>
            <span>₹{(item.subtotal_paise / 100).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {order.status === 'delivered' && impactRes?.data && (
        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-earth-900">
            <Sprout className="size-4 text-primary-700" /> Your Impact
          </p>
          <p className="mb-2 text-xs text-earth-500">
            What you paid vs. a traditional mandi channel, per item.
          </p>
          {impactRes.data.items.map((item, i) => (
            <IEIMetric
              key={i}
              label={`${item.crop_type} · ${item.fpo_name ?? 'FPO'}${item.fpo_state ? `, ${item.fpo_state}` : ''}`}
              before={item.traditional_paise !== null ? formatRupees(item.traditional_paise) : '—'}
              after={formatRupees(item.bharatpure_paise)}
              delta={
                item.traditional_paise !== null
                  ? `+${formatRupees(item.bharatpure_paise - item.traditional_paise)} to farmer`
                  : ''
              }
            />
          ))}
          <div className="mt-2 flex items-baseline justify-between border-t border-earth-200 pt-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-earth-500">Total extra to farmers</span>
            <span className="font-display text-lg font-bold text-success">{formatRupees(impactRes.data.total_uplift_paise)}</span>
          </div>
        </div>
      )}

      <Link to={`/consumer/orders`} className="text-center text-sm text-earth-500 hover:text-earth-700">
        &larr; Back to orders
      </Link>
    </div>
  )
}
