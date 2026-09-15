import client from './client'
import type { ApiSuccess } from '@/types/api.types'
import type { AuthUser, UserRole } from '@/types/auth.types'

export interface RegisterPayload {
  phone: string
  password: string
  full_name: string
  role: UserRole
  email?: string
  [key: string]: unknown // role-specific fields, see BHARATPURE-API.md register body
}

export interface LoginResult {
  accessToken: string
  user: AuthUser
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    client.post<ApiSuccess<{ userId: string; devOtp?: string }>>('/api/auth/register', payload).then((r) => r.data),

  verifyOtp: (payload: { phone: string; otp: string; purpose: 'registration' | 'password_reset' }) =>
    client.post<ApiSuccess<LoginResult>>('/api/auth/verify-otp', payload).then((r) => r.data),

  login: (payload: { identifier: string; password: string }) =>
    client.post<ApiSuccess<LoginResult>>('/api/auth/login', payload).then((r) => r.data),

  forgotPassword: (payload: { phone: string }) =>
    client.post<ApiSuccess<{ devOtp?: string }>>('/api/auth/forgot-password', payload).then((r) => r.data),

  verifyResetOtp: (payload: { phone: string; otp: string }) =>
    client.post<ApiSuccess<{ resetToken: string }>>('/api/auth/verify-reset-otp', payload).then((r) => r.data),

  resetPassword: (resetToken: string, newPassword: string) =>
    client
      .post<ApiSuccess<null>>(
        '/api/auth/reset-password',
        { newPassword },
        { headers: { Authorization: `Bearer ${resetToken}` } },
      )
      .then((r) => r.data),

  logout: () => client.post('/api/auth/logout').then((r) => r.data),
}
