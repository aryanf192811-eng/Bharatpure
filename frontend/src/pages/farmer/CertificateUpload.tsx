import { useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { qualityApi } from '@/api/quality.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CertificateUpload() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [certNumber, setCertNumber] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const formData = new FormData()
      formData.append('certificate', file!)
      formData.append('batch_id', batchId!)
      formData.append('cert_number', certNumber)
      formData.append('issued_at', issuedAt)
      return qualityApi.uploadCertificate(formData)
    },
    onSuccess: () => {
      toast.success('Certificate uploaded and linked to the batch.')
      navigate(`/farmer/batches/${batchId}`)
    },
    onError: (err: AxiosError<{ error?: { code?: string; message?: string } }>) => {
      const code = err.response?.data?.error?.code
      setError(
        code === 'INVALID_MIME_TYPE'
          ? 'Only PDF files are accepted.'
          : code === 'FILE_TOO_LARGE'
            ? 'File must be under 5MB.'
            : (err.response?.data?.error?.message ?? 'Upload failed.'),
      )
    },
  })

  const handleFileSelect = (selected: File | undefined) => {
    if (!selected) return
    setFile(selected)
    setError(null)
  }

  return (
    <div className="mx-auto flex max-w-[480px] flex-col p-4">
      <h1 className="font-display text-2xl font-bold tracking-tight text-earth-900">Upload NABL Certificate</h1>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mt-6 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary-400 bg-white p-8 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-800"
      >
        <UploadCloud className="size-8 text-primary-700" />
        <p className="text-sm font-medium text-earth-900">{file ? file.name : 'Tap to select a PDF'}</p>
        {file && <p className="text-xs text-earth-500">{(file.size / 1024).toFixed(0)} KB</p>}
        <p className="text-xs text-earth-500">Max 5MB, PDF only</p>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files?.[0])}
      />

      <div className="mt-6 flex flex-col gap-4">
        <div>
          <Label htmlFor="cert_number">Certificate Number</Label>
          <Input id="cert_number" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="issued_at">Issued Date</Label>
          <Input id="issued_at" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <Button
        type="button"
        size="lg"
        className="mt-6"
        disabled={!file || !certNumber || !issuedAt || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Uploading...' : 'Submit Certificate'}
      </Button>
    </div>
  )
}
