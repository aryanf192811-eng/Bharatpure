import { ArrowRight, FlaskConical, Leaf, Network, Shield, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { HERO_IMAGES } from '@/lib/cropImagery'
import type { UserRole } from '@/types/auth.types'

interface RoleOption {
  role: UserRole
  emoji: string
  label: string
  description: string
  fullWidth?: boolean
}

const ROLE_OPTIONS: RoleOption[] = [
  { role: 'FARMER', emoji: '🌾', label: 'Farmer / FPO', description: 'List harvest, guaranteed contracts & fair prices' },
  { role: 'CONSUMER', emoji: '🛒', label: 'Consumer', description: 'Traceable, single-origin NABL certified food' },
  { role: 'BULK_BUYER', emoji: '🏢', label: 'Bulk Buyer', description: 'Predictable sourcing, escrow & quality grades' },
  { role: 'LOGISTICS', emoji: '🚚', label: 'Logistics', description: 'Optimized routes, cold-chain IoT monitoring' },
  {
    role: 'ADMIN',
    emoji: '🏛️',
    label: 'Government / Admin',
    description: 'DPI, AgriStack integration & market intelligence',
    fullWidth: true,
  },
]

export default function Landing() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('FARMER')
  const navigate = useNavigate()

  const selectedOption = ROLE_OPTIONS.find((o) => o.role === selectedRole)!

  return (
    <div className="flex min-h-[100dvh] flex-col bg-earth-50 pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-10 pt-8">
        <header className="relative -mx-4 mb-6 flex flex-col items-center overflow-hidden rounded-b-lg px-4 pb-6 pt-8 text-center">
          <img
            src={HERO_IMAGES.turmericField}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary-900/80 via-primary-800/85 to-primary-800/95" />
          <div className="relative z-10 mb-3 flex size-[72px] items-center justify-center rounded-full bg-white p-2 shadow-sm">
            <Leaf className="size-9 text-primary-800" />
          </div>
          <h1 className="relative z-10 font-display text-3xl font-black tracking-tight text-white">BharatPure</h1>
          <p className="relative z-10 mt-1 font-body text-sm font-medium tracking-wide text-primary-100">
            India&apos;s Farm-to-Market Trust Network
          </p>
          <div className="relative z-10 mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-primary-900/60 px-3 py-1">
            <ShieldCheck className="size-3.5 text-gold-100" />
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-gold-100">
              NABL Lab Certified &amp; DPI Enabled
            </span>
          </div>
        </header>

        <section className="-mt-2 flex flex-col gap-4 rounded-lg bg-white p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-earth-500">
              Select your role to enter
            </span>
            <span className="flex items-center gap-1 font-mono text-xs font-medium uppercase tracking-wider text-primary-700">
              <span className="size-1.5 rounded-full bg-primary-500 animate-pulse" />
              Live Gateway
            </span>
          </div>

          <div role="radiogroup" aria-label="BharatPure Roles" className="grid grid-cols-2 gap-2.5">
            {ROLE_OPTIONS.map((option) => {
              const isActive = option.role === selectedRole
              return (
                <button
                  key={option.role}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setSelectedRole(option.role)}
                  className={`flex min-h-11 flex-col justify-between rounded p-3 text-left shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2 ${
                    option.fullWidth ? 'col-span-2 flex-row items-center gap-3 p-3.5' : ''
                  } ${isActive ? 'bg-primary-50 shadow-md' : 'bg-earth-100 hover:bg-earth-200/60'}`}
                >
                  {option.fullWidth ? (
                    <>
                      <span className="flex items-center gap-3">
                        <span className="text-2xl">{option.emoji}</span>
                        <span>
                          <span className="block font-body text-lg font-semibold text-earth-900">{option.label}</span>
                          <span className="mt-0.5 block font-body text-xs font-normal leading-snug text-earth-700">
                            {option.description}
                          </span>
                        </span>
                      </span>
                      {isActive && (
                        <span className="rounded-sm bg-primary-800 px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider text-white">
                          Active
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="mb-1.5 flex w-full items-start justify-between">
                        <span className="text-2xl leading-none">{option.emoji}</span>
                        {isActive && (
                          <span className="rounded-sm bg-primary-800 px-1.5 py-0.5 font-mono text-xs font-medium uppercase tracking-wider text-white">
                            Active
                          </span>
                        )}
                      </span>
                      <span>
                        <span className="block font-body text-lg font-semibold text-earth-900">{option.label}</span>
                        <span className="mt-1 block font-body text-xs font-normal leading-snug text-earth-700">
                          {option.description}
                        </span>
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => navigate(`/register?role=${selectedRole}`)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-primary-800 px-5 py-3.5 font-body text-base font-semibold text-white shadow-md transition-all hover:bg-primary-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
          >
            Continue as {selectedOption.label}
            <ArrowRight className="size-5 text-gold-100" />
          </button>

          <div className="flex items-center justify-center pt-2">
            <p className="font-body text-sm font-normal text-earth-700">
              Already registered?{' '}
              <Link
                to="/login"
                className="ml-1 font-semibold text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>

        <footer className="mt-6 flex items-center justify-around rounded-md border border-earth-200 bg-white px-4 py-3 text-earth-700 shadow-sm">
          <div className="flex items-center gap-1.5">
            <Shield className="size-4 text-primary-700" />
            <span className="font-mono text-xs font-medium uppercase tracking-wider">256-Bit Escrow</span>
          </div>
          <div className="size-1 rounded-full bg-earth-200" />
          <div className="flex items-center gap-1.5">
            <FlaskConical className="size-4 text-gold-800" />
            <span className="font-mono text-xs font-medium uppercase tracking-wider">NABL Lab Tested</span>
          </div>
          <div className="size-1 rounded-full bg-earth-200" />
          <div className="flex items-center gap-1.5">
            <Network className="size-4 text-primary-700" />
            <span className="font-mono text-xs font-medium uppercase tracking-wider">AgriStack DPI</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
