import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, MapPin } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { qrApi } from '@/api/qr.api'
import { BIRTimeline } from '@/components/shared/BIRTimeline'
import { QualityBadge } from '@/components/shared/QualityBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth.store'

export default function QrScanResult() {
  const { qrHash } = useParams<{ qrHash: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)

  const { data, isLoading, error } = useQuery({
    queryKey: ['qr', qrHash],
    queryFn: () => qrApi.scan(qrHash!),
    enabled: !!qrHash,
    retry: false,
  })

  const burnMutation = useMutation({
    mutationFn: () => qrApi.burn(qrHash!),
    onSuccess: () => {
      toast.success('QR code invalidated. Thank you for confirming.')
      queryClient.invalidateQueries({ queryKey: ['qr', qrHash] })
    },
    onError: (err: { response?: { data?: { error?: { code?: string } } } }) => {
      if (err.response?.data?.error?.code === 'QR_ALREADY_BURNED') {
        toast.info('This QR code has already been burned.')
      } else {
        toast.error('Could not burn this QR code.')
      }
    },
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[480px] p-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-display text-xl font-bold text-earth-900">QR code not recognized</p>
        <p className="text-sm text-earth-500">This code may be invalid or the batch has been removed.</p>
      </div>
    )
  }

  const batch = data.data as typeof data.data & {
    cluster_name?: string
    district?: string
    state?: string
    fpo_name?: string
    test_result?: string
    purity_score?: number
  }

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-5 pb-10">
      <div className="flex flex-col items-center gap-1 bg-primary-800 px-4 py-6 text-center text-white">
        <BadgeCheck className="size-8 text-gold-100" />
        <p className="font-display text-lg font-bold">BATCH VERIFIED</p>
        <p className="font-mono text-xs text-primary-100">{batch.batch_code}</p>
        <p className="mt-1 text-xs text-primary-100">{batch.qr_burned_at ? 'QR Burned ✓' : 'QR not yet burned'}</p>
      </div>

      <div className="flex flex-col gap-4 px-4">
        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-earth-900">{batch.fpo_name ?? 'Verified FPO'}</p>
          <p className="flex items-center gap-1 text-xs text-earth-500">
            <MapPin className="size-3.5" /> {batch.district}, {batch.state}
          </p>
          <p className="mt-1 text-xs text-earth-500">Harvested {new Date(batch.harvest_date).toLocaleDateString('en-IN')}</p>
        </div>

        {batch.quality_score && (
          <div className="rounded-md bg-success-bg p-4">
            <p className="text-sm font-semibold text-earth-900">Quality Verified</p>
            <QualityBadge score={Number(batch.quality_score)} tier={batch.test_result === 'PASS' ? 'NABL' : 'Rapid'} />
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-earth-900">Journey Timeline</p>
          <BIRTimeline events={batch.bir_events ?? []} />
        </div>

        {!batch.qr_burned_at && (
          <div className="rounded-md border border-earth-200 bg-white p-4">
            <p className="text-sm font-semibold text-earth-900">Burn QR on Opening</p>
            <p className="mt-1 text-xs text-earth-700">
              When you open the package, burn the QR to prevent reuse by others.
            </p>
            {accessToken ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-danger text-danger hover:bg-danger-bg"
                disabled={burnMutation.isPending}
                onClick={() => burnMutation.mutate()}
              >
                {burnMutation.isPending ? 'Burning...' : "I've opened the package — Burn QR"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => navigate('/login', { state: { returnUrl: location.pathname } })}
              >
                Login to burn QR
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
