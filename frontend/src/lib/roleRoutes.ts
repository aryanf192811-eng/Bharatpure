import type { UserRole } from '@/types/auth.types'

export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  FARMER: '/farmer/dashboard',
  CONSUMER: '/consumer/browse',
  BULK_BUYER: '/buyer/dashboard',
  LOGISTICS: '/logistics/dashboard',
  ADMIN: '/admin/dashboard',
}
