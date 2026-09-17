import { Leaf } from 'lucide-react'
import type { ReactNode } from 'react'

import { HERO_IMAGES } from '@/lib/cropImagery'

interface AuthLayoutProps {
  children: ReactNode
}

// Two-column shell shared by Register/Login/Forgot/Reset per BHARATPURE-UI.md: green hero panel
// on the left (desktop only), white form panel on the right; single column on mobile.
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="relative hidden flex-col overflow-hidden text-white md:flex md:w-2/5">
        <img src={HERO_IMAGES.turmericField} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-900/70 via-transparent to-transparent" />
        <div className="relative z-10 flex items-center gap-3 px-8 py-8">
          <div className="flex size-12 items-center justify-center rounded-full bg-white p-2 shadow-lg">
            <Leaf className="size-6 text-primary-800" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight drop-shadow-md">BharatPure</h1>
        </div>
        <p className="relative z-10 mt-auto max-w-xs px-12 py-16 text-primary-50 drop-shadow-md">
          India&apos;s Farm-to-Market Trust Network — every batch verified, every price fair.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-earth-50 px-4 py-10 md:bg-white">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
