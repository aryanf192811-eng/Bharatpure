import type { BatchStatus } from '@/types/batch.types'

const STATUS_STYLES: Record<BatchStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-earth-100 text-earth-700' },
  pending_test: { label: 'Pending Test', className: 'bg-warning-bg text-warning' },
  test_passed: { label: 'Test Passed', className: 'bg-success-bg text-success' },
  test_failed: { label: 'Test Failed', className: 'bg-danger-bg text-danger' },
  listed: { label: 'Listed', className: 'bg-primary-100 text-primary-800' },
  partially_sold: { label: 'Partially Sold', className: 'bg-gold-100 text-gold-800' },
  sold: { label: 'Sold', className: 'bg-info-bg text-info' },
  dispatched: { label: 'Dispatched', className: 'bg-info-bg text-info' },
  delivered: { label: 'Delivered', className: 'bg-success-bg text-success' },
  rejected_post_delivery: { label: 'Rejected', className: 'bg-danger-bg text-danger' },
}

interface BatchStatusPillProps {
  status: BatchStatus
}

export function BatchStatusPill({ status }: BatchStatusPillProps) {
  const style = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  )
}
