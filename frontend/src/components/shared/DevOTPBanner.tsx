import { useState } from 'react'
import { X } from 'lucide-react'

interface DevOTPBannerProps {
  otp: string
}

export function DevOTPBanner({ otp }: DevOTPBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-earth-900">
      <p>
        Dev mode: Your OTP is <span className="font-mono font-semibold">{otp}</span>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="rounded-full p-1 text-earth-700 transition-shadow hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
