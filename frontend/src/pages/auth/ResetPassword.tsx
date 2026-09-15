import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { authApi } from '@/api/auth.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { passwordSchema } from '@/lib/validators/auth.validators'

const resetSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ResetFields = z.infer<typeof resetSchema>

export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { resetToken?: string } }
  const resetToken = location.state?.resetToken

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetFields>({ resolver: zodResolver(resetSchema) })

  const mutation = useMutation({
    mutationFn: (data: ResetFields) => authApi.resetPassword(resetToken!, data.newPassword),
    onSuccess: () => {
      toast.success('Password reset successful. Please sign in.')
      navigate('/login', { replace: true })
    },
    onError: (err: AxiosError<{ error?: { code?: string; message?: string } }>) => {
      const message =
        err.response?.data?.error?.code === 'SAME_AS_OLD_PASSWORD'
          ? 'New password must be different from your current password.'
          : (err.response?.data?.error?.message ?? 'Could not reset password.')
      setError('newPassword', { message })
    },
  })

  if (!resetToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-earth-700">This reset link has expired. Please start over from Forgot Password.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-earth-50 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-md">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-earth-900">Create new password</h1>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" type="password" {...register('newPassword')} className="mt-1.5" />
            {errors.newPassword && <p className="mt-1 text-xs text-danger">{errors.newPassword.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} className="mt-1.5" />
            {errors.confirmPassword && <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>}
          </div>
          <Button type="submit" size="lg" disabled={mutation.isPending} className="mt-2">
            {mutation.isPending ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
