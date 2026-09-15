import client from './client'
import type { ApiSuccess } from '@/types/api.types'
import type { Batch } from '@/types/batch.types'

export const qrApi = {
  scan: (qrHash: string) => client.get<ApiSuccess<Batch>>(`/api/qr/scan/${qrHash}`).then((r) => r.data),

  burn: (qrHash: string) => client.post<ApiSuccess<{ message: string }>>(`/api/qr/burn/${qrHash}`, {}).then((r) => r.data),

  generate: (batchId: string) =>
    client
      .get<ApiSuccess<{ qr_hash: string; qr_image_base64: string }>>(`/api/qr/generate/${batchId}`)
      .then((r) => r.data),
}
