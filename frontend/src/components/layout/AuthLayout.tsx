import { Leaf } from 'lucide-react'
import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

// Two-column shell shared by Register/Login/Forgot/Reset per BHARATPURE-UI.md: green hero panel
// on the left (desktop only), white form panel on the right; single column on mobile.
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="hidden flex-col justify-center bg-primary-800 px-12 py-16 text-white md:flex md:w-2/5">
        <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-white p-2">
          <Leaf className="size-7 text-primary-800" />
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight">BharatPure</h1>
        <p className="mt-3 max-w-xs text-primary-100">
          India&apos;s Farm-to-Market Trust Network — every batch verified, every price fair.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-earth-50 px-4 py-10 md:bg-white">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
