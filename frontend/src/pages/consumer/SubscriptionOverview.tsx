import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'

// Subscriptions are documented in BHARATPURE-UI.md as "no separate table needed -- use a
// subscription_metadata JSONB field on orders for Phase 5", but that field and its supporting
// endpoints were never built. Honest empty state rather than fake recurring-order data.
export default function SubscriptionOverview() {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-3 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-earth-100 text-earth-500">
        <CalendarClock className="size-6" />
      </div>
      <h1 className="font-display text-xl font-bold text-earth-900">Subscriptions</h1>
      <p className="text-sm text-earth-700">
        Repeat-delivery subscriptions aren&apos;t part of this prototype build yet. For now, place a fresh order
        each time from Browse.
      </p>
      <Link to="/consumer/browse" className="text-sm font-semibold text-primary-700 hover:underline">
        Browse verified produce
      </Link>
    </div>
  )
}
