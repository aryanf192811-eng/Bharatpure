import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '@/stores/auth.store'
import type { ApiSuccess } from '@/types/api.types'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // sends the HttpOnly refreshToken cookie automatically
})

// REQUEST: attach the access token from the Zustand auth store.
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// RESPONSE: on a 401, refresh the access token once and retry. Concurrent 401s while a
// refresh is already in flight queue behind it instead of each firing their own refresh call.
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let isRefreshing = false
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = []

const flushQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }
    // The refresh call itself 401ing must not recurse into this handler.
    if (original.url?.includes('/api/auth/refresh')) {
      return Promise.reject(error)
    }

    original._retry = true

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return client(original)
      })
    }

    isRefreshing = true
    try {
      const { data } = await axios.post<ApiSuccess<{ accessToken: string }>>(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      )
      const newToken = data.data.accessToken
      useAuthStore.getState().setAccessToken(newToken)
      flushQueue(null, newToken)
      original.headers.Authorization = `Bearer ${newToken}`
      return client(original)
    } catch (refreshError) {
      flushQueue(refreshError, null)
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default client
