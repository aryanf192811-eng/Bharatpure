export interface ApiSuccess<T> {
  success: true
  data: T
  message?: string
}

export interface ApiErrorBody {
  success: false
  error: {
    code: string
    message: string
    details?: unknown[]
  }
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiPaginated<T> {
  success: true
  data: T[]
  pagination: Pagination
}
