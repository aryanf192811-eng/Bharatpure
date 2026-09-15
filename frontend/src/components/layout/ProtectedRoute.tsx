import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types/auth.types'

interface ProtectedRouteProps {
  role: UserRole
}

export function ProtectedRoute({ role }: ProtectedRouteProps) {
  const location = useLocation()
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)

  if (!accessToken || !user) {
    return <Navigate to="/login" state={{ returnUrl: location.pathname }} replace />
  }

  if (user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
