import client from './client'
import type { ApiPaginated, ApiSuccess } from '@/types/api.types'
import type { AuthUser } from '@/types/auth.types'

export interface UserProfile extends AuthUser {
  phone: string
  email: string | null
  profile: Record<string, unknown>
}

export interface Notification {
  id: string
  title: string
  body: string
  read_at: string | null
  created_at: string
}

export const userApi = {
  me: () => client.get<ApiSuccess<UserProfile>>('/api/users/me').then((r) => r.data),

  updateMe: (payload: { full_name?: string; email?: string }) =>
    client.patch<ApiSuccess<UserProfile>>('/api/users/me', payload).then((r) => r.data),

  notifications: (params?: { unread_only?: boolean; page?: number; limit?: number }) =>
    client.get<ApiPaginated<Notification>>('/api/users/me/notifications', { params }).then((r) => r.data),
}
