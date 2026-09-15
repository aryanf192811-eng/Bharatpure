import client from './client'
import type { ApiSuccess } from '@/types/api.types'

export interface QualityTest {
  id: string
  batch_id: string
  tier: 'TIER1' | 'TIER2'
  result: 'PASS' | 'FAIL' | 'PENDING'
  purity_score: number | null
  test_parameters: Record<string, unknown>
  lab_name: string | null
  lab_accreditation: string | null
  tested_at: string
  created_at: string
}

export interface QualityCertificate {
  id: string
  cert_number: string
  file_size_bytes: number
  mime_type: string
  issued_at: string
  expires_at: string | null
  uploaded_at: string
}

export interface BSampleRequest {
  id: string
  quality_test_id: string
  requested_by: string
  request_window_end: string
  status: 'pending' | 'lab_selected' | 'dispatched' | 'result_pass' | 'result_fail' | 'expired'
  selected_lab: string | null
  result: 'PASS' | 'FAIL' | null
  created_at: string
}

export const qualityApi = {
  submitTest: (payload: {
    batch_id: string
    tier: 'TIER1' | 'TIER2'
    result: 'PASS' | 'FAIL'
    purity_score?: number
    test_parameters?: Record<string, unknown>
    lab_name?: string
    rejection_reason?: string
  }) => client.post<ApiSuccess<QualityTest>>('/api/quality/tests', payload).then((r) => r.data),

  uploadCertificate: (formData: FormData) =>
    client
      .post<ApiSuccess<{ cert_number: string; cert_url: string }>>('/api/quality/certificates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),

  getBatchTests: (batchId: string) =>
    client.get<ApiSuccess<QualityTest[]>>(`/api/quality/batches/${batchId}/tests`).then((r) => r.data),

  getCertificatesForBatch: (batchId: string) =>
    client.get<ApiSuccess<QualityCertificate[]>>(`/api/quality/batches/${batchId}/certificates`).then((r) => r.data),

  // Streams the PDF as a blob and triggers the browser's save dialog directly -- there's no JSON
  // response to hand back, this is a side-effecting action, not a data fetch.
  downloadCertificate: async (certId: string, certNumber: string) => {
    const response = await client.get(`/api/quality/certificates/${certId}/download`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${certNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  },

  getBSamples: (batchId: string) =>
    client.get<ApiSuccess<BSampleRequest[]>>(`/api/quality/b-samples/${batchId}`).then((r) => r.data),

  requestBSample: (batchId: string, selectedLab: string) =>
    client
      .post<ApiSuccess<BSampleRequest>>(`/api/quality/b-samples/${batchId}/request`, { selected_lab: selectedLab })
      .then((r) => r.data),
}
