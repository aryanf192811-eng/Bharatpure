import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { batchApi } from '@/api/batch.api'
import { listingApi } from '@/api/listing.api'
import { qualityApi } from '@/api/quality.api'
import { BatchStatusPill } from '@/components/shared/BatchStatusPill'
import { BIRTimeline } from '@/components/shared/BIRTimeline'
import { QualityBadge } from '@/components/shared/QualityBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getCropPhoto } from '@/lib/cropImagery'

const STATUS_HERO_BG: Record<string, string> = {
  draft: 'bg-earth-100',
  pending_test: 'bg-warning-bg',
  test_passed: 'bg-success-bg',
  test_failed: 'bg-danger-bg',
  listed: 'bg-success-bg',
  partially_sold: 'bg-gold-100',
  sold: 'bg-info-bg',
  dispatched: 'bg-info-bg',
  delivered: 'bg-success-bg',
  rejected_post_delivery: 'bg-danger-bg',
}

export default function BatchDetail() {
  const { batchId } = useParams<{ batchId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [listPrice, setListPrice] = useState('')
  const [listMinKg, setListMinKg] = useState('1')
  const [bsampleLab, setBsampleLab] = useState('')

  const { data: batchRes, isLoading } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => batchApi.getById(batchId!),
    enabled: !!batchId,
  })
  const { data: testsRes } = useQuery({
    queryKey: ['batch', batchId, 'tests'],
    queryFn: () => qualityApi.getBatchTests(batchId!),
    enabled: !!batchId,
  })
  const { data: myListings } = useQuery({
    queryKey: ['farmer', 'listings'],
    queryFn: () => listingApi.list({ limit: 100 }),
  })
  const { data: bsamplesRes } = useQuery({
    queryKey: ['batch', batchId, 'bsamples'],
    queryFn: () => qualityApi.getBSamples(batchId!),
    enabled: !!batchId && batchRes?.data.status === 'test_failed',
  })
  const { data: certsRes } = useQuery({
    queryKey: ['batch', batchId, 'certificates'],
    queryFn: () => qualityApi.getCertificatesForBatch(batchId!),
    enabled: !!batchId,
  })

  const submitForTesting = useMutation({
    mutationFn: () => batchApi.updateStatus(batchId!, 'pending_test'),
    onSuccess: () => {
      toast.success('Batch submitted for testing.')
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
    },
    onError: () => toast.error('Could not submit batch for testing.'),
  })

  const createListing = useMutation({
    mutationFn: () =>
      listingApi.create({ batch_id: batchId!, price_per_kg_paise: Math.round(Number(listPrice) * 100), min_order_kg: Number(listMinKg) }),
    onSuccess: () => {
      toast.success('Batch listed on the marketplace.')
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
    },
    onError: () => toast.error('Could not create listing.'),
  })

  const requestBSample = useMutation({
    mutationFn: () => qualityApi.requestBSample(batchId!, bsampleLab),
    onSuccess: () => {
      toast.success('B-sample lab selection submitted.')
      queryClient.invalidateQueries({ queryKey: ['batch', batchId, 'bsamples'] })
    },
    onError: () => toast.error('Could not submit B-sample request.'),
  })

  if (isLoading || !batchRes) {
    return (
      <div className="mx-auto flex max-w-[480px] flex-col gap-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const batch = batchRes.data
  const tests = testsRes?.data ?? []
  const listing = myListings?.data.find((l) => l.batch_id === batchId)
  const bsample = bsamplesRes?.data[0]
  const certs = certsRes?.data ?? []

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-5 p-4">
      <div className={`overflow-hidden rounded-md shadow-sm ${STATUS_HERO_BG[batch.status] ?? 'bg-earth-100'}`}>
        <img src={getCropPhoto(batch.crop_type, batch.batch_code.length)} alt="" className="h-28 w-full object-cover" />
        <div className="p-4">
          <p className="font-mono text-sm font-semibold tracking-wide text-earth-900">{batch.batch_code}</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-earth-900">{batch.crop_type}</h1>
          <div className="mt-2 flex items-center gap-2">
            <BatchStatusPill status={batch.status} />
            {batch.quality_score && <QualityBadge score={Number(batch.quality_score)} tier="Rapid" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-white p-3 text-center shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Quantity</p>
          <p className="mt-1 font-display text-lg font-bold text-earth-900">{batch.total_quantity_kg} kg</p>
        </div>
        <div className="rounded-md bg-white p-3 text-center shadow-sm">
          <p className="font-mono text-xs uppercase tracking-wider text-earth-500">Remaining</p>
          <p className="mt-1 font-display text-lg font-bold text-earth-900">{batch.remaining_quantity_kg} kg</p>
        </div>
      </div>

      {batch.status === 'draft' && (
        <Button type="button" size="lg" disabled={submitForTesting.isPending} onClick={() => submitForTesting.mutate()}>
          {submitForTesting.isPending ? 'Submitting...' : 'Submit for Testing'}
        </Button>
      )}

      {batch.status === 'test_passed' && !listing && (
        <div className="flex flex-col gap-3 rounded-md bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-earth-900">List this batch</p>
          <Input placeholder="Price per kg (₹)" type="number" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
          <Input placeholder="Minimum order (kg)" type="number" value={listMinKg} onChange={(e) => setListMinKg(e.target.value)} />
          <Button type="button" disabled={!listPrice || createListing.isPending} onClick={() => createListing.mutate()}>
            {createListing.isPending ? 'Listing...' : 'Create Listing'}
          </Button>
        </div>
      )}

      {listing && (
        <div className="flex flex-col gap-1 rounded-md bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-earth-900">Listing</p>
          <p className="text-2xl font-bold text-primary-800">₹{(listing.price_per_kg_paise / 100).toFixed(0)}/kg</p>
          <p className="text-xs text-earth-500">
            Min order {listing.min_order_kg} kg &middot; {listing.listing_type} &middot; {listing.status}
          </p>
        </div>
      )}

      {tests.length > 0 && (
        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-earth-900">Quality Test Results</p>
          {tests.map((test) => (
            <div key={test.id} className="flex items-center justify-between border-b border-earth-100 py-2 last:border-b-0">
              <div>
                <p className="text-sm font-medium text-earth-900">{test.tier} &middot; {test.result}</p>
                <p className="text-xs text-earth-500">{new Date(test.tested_at).toLocaleDateString('en-IN')}</p>
              </div>
              {test.purity_score !== null && <QualityBadge score={test.purity_score} tier={test.tier === 'TIER2' ? 'NABL' : 'Rapid'} />}
            </div>
          ))}
          {certs.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {certs.map((cert) => (
                <button
                  key={cert.id}
                  type="button"
                  onClick={() => qualityApi.downloadCertificate(cert.id, cert.cert_number)}
                  className="flex items-center gap-1.5 text-xs font-medium text-success hover:underline"
                >
                  <Download className="size-3.5" /> Download {cert.cert_number}.pdf
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {batch.status === 'test_failed' && bsample && (
        <div className="rounded-md border border-danger/20 bg-danger-bg/40 p-4">
          <p className="text-sm font-semibold text-earth-900">B-Sample Referee Review</p>
          <p className="mt-1 text-xs text-earth-700">
            Window closes {new Date(bsample.request_window_end).toLocaleString('en-IN')}
          </p>
          {bsample.status === 'pending' ? (
            <div className="mt-3 flex gap-2">
              <Input placeholder="Selected lab" value={bsampleLab} onChange={(e) => setBsampleLab(e.target.value)} />
              <Button type="button" disabled={!bsampleLab || requestBSample.isPending} onClick={() => requestBSample.mutate()}>
                Request
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs font-medium text-earth-900">Status: {bsample.status}</p>
          )}
        </div>
      )}

      {batch.status === 'test_passed' && (
        <button
          type="button"
          onClick={() => navigate(`/farmer/batches/${batchId}/upload-certificate`)}
          className="text-center text-sm font-semibold text-primary-700 hover:underline"
        >
          Upload NABL Certificate
        </button>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-earth-900">Batch Identity Record</p>
        <BIRTimeline events={[...(batch.bir_events ?? [])].reverse()} />
      </div>

      <Link to="/farmer/batches" className="text-center text-sm text-earth-500 hover:text-earth-700">
        &larr; Back to all batches
      </Link>
    </div>
  )
}
