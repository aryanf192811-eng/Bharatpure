import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface Cluster {
  id: string
  name: string
  state: string
  district: string
  crop_type: string
}

export const clusterApi = {
  list: (params?: { state?: string; crop_type?: string }) =>
    client.get<ApiSuccess<Cluster[]>>('/api/clusters', { params }).then((r) => r.data),

  getById: (id: string) => client.get<ApiSuccess<Cluster>>(`/api/clusters/${id}`).then((r) => r.data),
}
