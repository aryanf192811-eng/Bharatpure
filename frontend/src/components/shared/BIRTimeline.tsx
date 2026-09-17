import {
  AlertTriangle,
  Award,
  Ban,
  CheckCircle2,
  Cog,
  Flag,
  FlaskConical,
  Home,
  Landmark,
  Lock,
  type LucideIcon,
  Package,
  PackageCheck,
  QrCode,
  ScanLine,
  Send,
  Sprout,
  Tag,
  Thermometer,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react'

import type { BirEvent } from '@/types/batch.types'

// Every entry matches a real event_type in the bir_events CHECK constraint
// (db/migrations/010_create_bir_events.js) -- kept in sync with that canonical list so no real
// event ever falls through to the raw-string fallback below.
const EVENT_META: Record<string, { label: string; dotClassName: string; icon: LucideIcon }> = {
  BatchCreated: { label: 'Batch Created', dotClassName: 'bg-primary-600', icon: Package },
  HarvestDataLogged: { label: 'Harvested at Farm', dotClassName: 'bg-primary-600', icon: Sprout },
  ProcessingStarted: { label: 'Processing Started', dotClassName: 'bg-primary-600', icon: Cog },
  ProcessingCompleted: { label: 'Processing Completed', dotClassName: 'bg-primary-600', icon: CheckCircle2 },
  RapidTestInitiated: { label: 'Quality Test Started', dotClassName: 'bg-gold-600', icon: FlaskConical },
  RapidTestPassed: { label: 'Quality Test Passed', dotClassName: 'bg-success', icon: FlaskConical },
  RapidTestFailed: { label: 'Quality Test Failed', dotClassName: 'bg-danger', icon: XCircle },
  BSampleSealed: { label: 'B-Sample Sealed for Referee Lab', dotClassName: 'bg-gold-600', icon: Lock },
  NABLTestDispatched: { label: 'Dispatched to NABL Lab', dotClassName: 'bg-gold-600', icon: Send },
  NABLCertificateLinked: { label: 'NABL Certificate Linked', dotClassName: 'bg-success', icon: Award },
  BatchRejected: { label: 'Batch Rejected', dotClassName: 'bg-danger', icon: XCircle },
  BatchListed: { label: 'Listed on Marketplace', dotClassName: 'bg-primary-600', icon: Tag },
  OrderAllocated: { label: 'Order Allocated', dotClassName: 'bg-info', icon: PackageCheck },
  DispatchedToHub: { label: 'Dispatched to Cold-Chain Hub', dotClassName: 'bg-info', icon: Truck },
  TempLogEvent: { label: 'Temperature Logged', dotClassName: 'bg-info', icon: Thermometer },
  TemperatureBreachDetected: { label: 'Temperature Breach Detected', dotClassName: 'bg-danger', icon: AlertTriangle },
  DeliveredToConsumer: { label: 'Delivered', dotClassName: 'bg-success', icon: Home },
  QRScanned: { label: 'QR Scanned', dotClassName: 'bg-info', icon: ScanLine },
  QRBurned: { label: 'QR Burned', dotClassName: 'bg-earth-700', icon: Ban },
  EscrowReleased: { label: 'Escrow Released', dotClassName: 'bg-success', icon: Landmark },
  DisputeRaised: { label: 'Dispute Raised', dotClassName: 'bg-danger', icon: Flag },
  DisputeResolved: { label: 'Dispute Resolved', dotClassName: 'bg-success', icon: CheckCircle2 },
  BatchWrittenOff: { label: 'Batch Written Off', dotClassName: 'bg-danger', icon: Trash2 },
}

interface BIRTimelineProps {
  events: BirEvent[]
}

export function BIRTimeline({ events }: BIRTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-earth-500">No events recorded yet.</p>
  }

  return (
    <ol className="relative border-l-2 border-primary-100 pl-8">
      {events.map((event, index) => {
        const meta = EVENT_META[event.event_type] ?? { label: event.event_type, dotClassName: 'bg-earth-500', icon: QrCode }
        const Icon = meta.icon
        return (
          <li key={`${event.event_type}-${event.created_at}-${index}`} className="mb-5 last:mb-0">
            <span className={`absolute -left-[17px] flex size-8 items-center justify-center rounded-full text-white shadow-sm ring-4 ring-earth-50 ${meta.dotClassName}`}>
              <Icon className="size-4" />
            </span>
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
