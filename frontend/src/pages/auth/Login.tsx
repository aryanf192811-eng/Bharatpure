import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { authApi } from '@/api/auth.api'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DASHBOARD_PATH_BY_ROLE } from '@/lib/roleRoutes'
import { useAuthStore } from '@/stores/auth.store'

const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your phone or email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFields = z.infer<typeof loginSchema>

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [suspendedError, setSuspendedError] = useState(false)
  const navigate = useNavigate()
  const location = useLocation() as { state?: { returnUrl?: string } }
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setUser = useAuthStore((s) => s.setUser)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFields>({ resolver: zodResolver(loginSchema) })

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (res) => {
      setAccessToken(res.data.accessToken)
      setUser(res.data.user)
      navigate(location.state?.returnUrl ?? DASHBOARD_PATH_BY_ROLE[res.data.user.role], { replace: true })
    },
    onError: (err: AxiosError<{ error?: { code?: string; message?: string } }>, variables) => {
      const code = err.response?.data?.error?.code
      const message = err.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
      if (code === 'OTP_REQUIRED') {
        navigate('/verify-otp', { state: { phone: variables.identifier, purpose: 'registration' } })
        return
      }
      if (code === 'ACCOUNT_SUSPENDED') {
        setSuspendedError(true)
        return
      }
      setSuspendedError(false)
      setError('password', { message })
    },
  })

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-earth-900">Welcome back</h1>

      {suspendedError && (
        <div className="mt-4 rounded border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
          Your account has been suspended. Contact support for assistance.
        </div>
      )}

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div>
          <Label htmlFor="identifier">Phone or Email</Label>
          <Input id="identifier" {...register('identifier')} className="mt-1.5" autoFocus />
          {errors.identifier && <p className="mt-1 text-xs text-danger">{errors.identifier.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative mt-1.5">
            <Input id="password" type={showPassword ? 'text' : 'password'} {...register('password')} />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-earth-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
          <Link to="/forgot-password" className="mt-1.5 block text-right text-sm font-medium text-primary-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2">
          {mutation.isPending ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-earth-700">
        New to BharatPure?{' '}
        <Link to="/" className="font-semibold text-primary-700 hover:underline">
          Create account
        </Link>
      </p>
    </AuthLayout>
  )
}
