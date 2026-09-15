import type { BirEvent } from '@/types/batch.types'

const EVENT_LABELS: Record<string, { label: string; dotClassName: string }> = {
  BatchCreated: { label: 'Batch Created', dotClassName: 'bg-primary-600' },
  HarvestDataLogged: { label: 'Harvest Data Logged', dotClassName: 'bg-primary-600' },
  ProcessingStarted: { label: 'Processing Started', dotClassName: 'bg-primary-600' },
  RapidTestPassed: { label: 'Rapid Test Passed', dotClassName: 'bg-success' },
  RapidTestFailed: { label: 'Rapid Test Failed', dotClassName: 'bg-danger' },
  NABLCertificateLinked: { label: 'NABL Certificate Linked', dotClassName: 'bg-success' },
  BatchListed: { label: 'Listed on Marketplace', dotClassName: 'bg-primary-600' },
  BatchRejected: { label: 'Batch Rejected', dotClassName: 'bg-danger' },
  QRScanned: { label: 'QR Scanned', dotClassName: 'bg-info' },
  QRBurned: { label: 'QR Burned', dotClassName: 'bg-earth-700' },
  TemperatureBreachDetected: { label: 'Temperature Breach Detected', dotClassName: 'bg-danger' },
  DeliveredToConsumer: { label: 'Delivered', dotClassName: 'bg-success' },
}

interface BIRTimelineProps {
  events: BirEvent[]
}

export function BIRTimeline({ events }: BIRTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-earth-500">No events recorded yet.</p>
  }

  return (
    <ol className="relative border-l border-earth-200 pl-5">
      {events.map((event, index) => {
        const meta = EVENT_LABELS[event.event_type] ?? { label: event.event_type, dotClassName: 'bg-earth-500' }
        return (
          <li key={`${event.event_type}-${event.created_at}-${index}`} className="mb-5 last:mb-0">
            <span className={`absolute -left-[5px] mt-1.5 size-2.5 rounded-full ring-4 ring-earth-50 ${meta.dotClassName}`} />
            <p className="text-sm font-semibold text-earth-900">{meta.label}</p>
            <time className="text-xs text-earth-500">
              {new Date(event.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </time>
            {event.actor_role && <p className="mt-0.5 text-xs text-earth-500">by {event.actor_role}</p>}
          </li>
        )
      })}
    </ol>
  )
}
