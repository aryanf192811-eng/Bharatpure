import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { authApi } from '@/api/auth.api'
import { userApi } from '@/api/user.api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth.store'

export default function Profile() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { data, isLoading } = useQuery({ queryKey: ['users', 'me'], queryFn: userApi.me })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login', { replace: true })
      toast.success('Signed out.')
    },
  })

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[480px] p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const profile = data.data

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-5 p-4">
      <div className="flex flex-col items-center gap-2 rounded-md bg-white p-6 shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-800 text-white">
          <User className="size-7" />
        </div>
        <p className="font-display text-lg font-bold text-earth-900">{profile.full_name}</p>
        <p className="text-sm text-earth-500">{profile.role}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm">
        <div className="flex justify-between text-sm">
          <span className="text-earth-500">Phone</span>
          <span className="font-medium text-earth-900">{profile.phone}</span>
        </div>
        {profile.email && (
          <div className="flex justify-between text-sm">
            <span className="text-earth-500">Email</span>
            <span className="font-medium text-earth-900">{profile.email}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-earth-500">Status</span>
          <span className="font-medium capitalize text-earth-900">{profile.status}</span>
        </div>
      </div>

      <Button type="button" variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  )
}
