export type UserRole = 'FARMER' | 'CONSUMER' | 'BULK_BUYER' | 'LOGISTICS' | 'ADMIN'

export type UserStatus = 'pending' | 'active' | 'suspended'

export interface AuthUser {
  id: string
  role: UserRole
  full_name: string
  status: UserStatus
}
