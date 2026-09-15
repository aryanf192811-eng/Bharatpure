import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export const dpiApi = {
  agristackFarmer: (farmerId: string) =>
    client.get<ApiSuccess<Record<string, unknown>>>(`/api/dpi/agristack/farmer/${farmerId}`).then((r) => r.data),

  enamPrices: (params: { crop_type: string; days?: number }) =>
    client.get<ApiSuccess<Record<string, unknown>[]>>('/api/dpi/enam/prices', { params }).then((r) => r.data),

  ondcListings: () => client.get<ApiSuccess<Record<string, unknown>>>('/api/dpi/ondc/listings').then((r) => r.data),
}
