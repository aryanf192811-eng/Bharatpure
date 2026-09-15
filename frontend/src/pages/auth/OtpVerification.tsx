import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { ArrowLeft, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { authApi } from '@/api/auth.api'
import { DevOTPBanner } from '@/components/shared/DevOTPBanner'
import { Button } from '@/components/ui/button'
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/roleRoutes'
import { useAuthStore } from '@/stores/auth.store'

interface OtpLocationState {
  phone?: string
  devOtp?: string
  purpose?: 'registration' | 'password_reset'
}

export default function OtpVerification() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: OtpLocationState }
  const { phone, purpose = 'registration' } = location.state ?? {}
  const [devOtp, setDevOtp] = useState(location.state?.devOtp)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(59)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setUser = useAuthStore((s) => s.setUser)

  const verifyMutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: (res) => {
      setAccessToken(res.data.accessToken)
      setUser(res.data.user)
      navigate(DASHBOARD_PATH_BY_ROLE[res.data.user.role], { replace: true })
    },
    onError: (err: AxiosError<{ error?: { code?: string; message?: string } }>) => {
      const code = err.response?.data?.error?.code
      setError(
        code === 'OTP_EXPIRED'
          ? 'Code expired. Request a new one.'
          : 'Incorrect code. Please check and try again.',
      )
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    },
  })

  const resendMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (res) => {
      setDevOtp(res.data.devOtp)
      setSecondsLeft(59)
      setError(null)
    },
  })

  if (!phone) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-earth-700">Missing phone number. Please restart the sign-up or reset flow.</p>
      </div>
    )
  }

  const submit = (otp: string) => {
    verifyMutation.mutate({ phone, otp, purpose })
  }

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
    if (next.every((d) => d !== '')) submit(next.join(''))
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const next = Array(6).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    if (pasted.length === 6) submit(pasted)
    else inputRefs.current[pasted.length]?.focus()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary-50 p-4">
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="mb-4 rounded-full p-2 text-earth-700 hover:bg-earth-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
        >
          <ArrowLeft className="size-5" />
        </button>

        <div className="flex flex-col items-center rounded-lg bg-white p-6 text-center shadow-md">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary-100">
            <Lock className="size-6 text-primary-800" />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-earth-900">
            Enter verification code
          </h1>
          <p className="mt-1 text-sm text-earth-700">We sent a 6-digit code to +91 {phone}</p>

          {devOtp && (
            <div className="mt-4 w-full">
              <DevOTPBanner otp={devOtp} />
            </div>
          )}

          <div className="mt-6 flex gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className={`h-[52px] w-12 rounded border text-center font-mono text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2 ${
                  error ? 'animate-pulse border-danger' : 'border-earth-200'
                }`}
              />
            ))}
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            disabled={verifyMutation.isPending || digits.some((d) => !d)}
            onClick={() => submit(digits.join(''))}
          >
            {verifyMutation.isPending ? 'Verifying...' : 'Verify Code'}
          </Button>

          <div className="mt-4 text-sm text-earth-700">
            {purpose === 'password_reset' ? (
              secondsLeft > 0 ? (
                <span>Didn&apos;t receive it? Resend ({secondsLeft}s)</span>
              ) : (
                <button
                  type="button"
                  onClick={() => resendMutation.mutate({ phone })}
                  className="font-semibold text-primary-700 hover:underline"
                >
                  Resend code
                </button>
              )
            ) : (
              <span>Didn&apos;t receive it? Contact support.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
