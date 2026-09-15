import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { authApi } from '@/api/auth.api'
import { DevOTPBanner } from '@/components/shared/DevOTPBanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [devOtp, setDevOtp] = useState<string | undefined>()
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [error, setError] = useState<string | null>(null)

  const sendOtpMutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (res) => {
      setDevOtp(res.data.devOtp)
      setStep('otp')
      setError(null)
    },
    onError: (err: AxiosError<{ error?: { message?: string } }>) => {
      setError(err.response?.data?.error?.message ?? 'No account found with this number.')
    },
  })

  const verifyMutation = useMutation({
    mutationFn: () => authApi.verifyResetOtp({ phone, otp }),
    onSuccess: (res) => {
      navigate('/reset-password', { state: { resetToken: res.data.resetToken } })
    },
    onError: () => setError('Incorrect or expired code.'),
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-earth-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-md">
        <Link to="/login" className="mb-4 inline-block text-sm font-medium text-primary-700 hover:underline">
          &larr; Back to login
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-earth-900">Reset your password</h1>

        {step === 'phone' ? (
          <>
            <p className="mt-1 text-sm text-earth-700">Enter your registered phone number.</p>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                sendOtpMutation.mutate({ phone })
              }}
            >
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} className="mt-1.5" />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" size="lg" disabled={sendOtpMutation.isPending}>
                {sendOtpMutation.isPending ? 'Sending...' : 'Send OTP'}
              </Button>
            </form>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {devOtp && <DevOTPBanner otp={devOtp} />}
            <div>
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="mt-1.5 font-mono tracking-widest"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="button" size="lg" disabled={verifyMutation.isPending || otp.length !== 6} onClick={() => verifyMutation.mutate()}>
              {verifyMutation.isPending ? 'Verifying...' : 'Verify Code'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
