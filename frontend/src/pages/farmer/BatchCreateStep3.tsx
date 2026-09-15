import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { batchApi } from '@/api/batch.api'
import { priceApi } from '@/api/price.api'
import { PriceRecommendationCard } from '@/components/shared/PriceRecommendationCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useBatchDraftStore } from '@/stores/batchDraft.store'

function buildNotes(draft: ReturnType<typeof useBatchDraftStore.getState>) {
  const parts = [draft.notes]
  if (draft.storageMethod) parts.push(`Storage: ${draft.storageMethod}.`)
  if (draft.treatmentApplied) parts.push(`Treatment: ${draft.treatmentDescription || 'applied'}.`)
  parts.push(`Pesticide use: ${draft.pesticideUse}.`)
  parts.push(`Farmer-estimated purity: ${draft.estimatedPurity}/100.`)
  return parts.filter(Boolean).join(' ')
}

export default function BatchCreateStep3() {
  const navigate = useNavigate()
  const draft = useBatchDraftStore()
  const [submitting, setSubmitting] = useState<'submit' | 'draft' | null>(null)

  const { data: priceRec, isLoading: priceLoading } = useQuery({
    queryKey: ['price', 'recommendation', draft.cropType, draft.estimatedPurity],
    queryFn: () => priceApi.recommendation({ crop_type: draft.cropType, quality_score: draft.estimatedPurity, city: 'Delhi' }),
    enabled: !!draft.cropType,
  })

  if (!draft.clusterId) {
    navigate('/farmer/batches/new/step-1', { replace: true })
    return null
  }

  const createBatch = async (submitForTesting: boolean) => {
    setSubmitting(submitForTesting ? 'submit' : 'draft')
    try {
      const created = await batchApi.create({
        cluster_id: draft.clusterId,
        crop_type: draft.cropType,
        harvest_date: draft.harvestDate,
        total_quantity_kg: Number(draft.totalQuantityKg),
        notes: buildNotes(draft),
      })
      if (submitForTesting) {
        await batchApi.updateStatus(created.data.id, 'pending_test')
        toast.success('Batch created and submitted for testing.')
      } else {
        toast.success('Batch saved as draft.')
      }
      draft.reset()
      navigate(`/farmer/batches/${created.data.id}`, { replace: true })
    } catch {
      toast.error('Could not create batch. Please try again.')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-[480px] flex-col p-4 pb-24">
      <p className="mb-1 text-xs font-semibold text-primary-800">Step 3 of 3</p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-earth-900">Price outlook</h1>
      <p className="mt-1 text-sm text-earth-700">
        Listing happens after your batch passes quality testing. Here&apos;s what to expect based on your estimate.
      </p>

      <div className="mt-4">
        {priceLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : priceRec ? (
          <PriceRecommendationCard
            low={priceRec.data.recommended_low_paise}
            high={priceRec.data.recommended_high_paise}
            commodity={priceRec.data.commodity_price_paise}
            premium={priceRec.data.premium_pct}
          />
        ) : (
          <p className="rounded-md bg-white p-3 text-sm text-earth-500 shadow-sm">Price data unavailable right now.</p>
        )}
      </div>

      <div className="mt-6">
        <Label htmlFor="asking_price">Your target price (₹/kg, optional note to yourself)</Label>
        <Input
          id="asking_price"
          type="number"
          placeholder="e.g. 188"
          onChange={(e) => draft.set({ notes: `${draft.notes} Target price: ₹${e.target.value}/kg.`.trim() })}
          className="mt-1.5"
        />
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <Button type="button" size="lg" disabled={submitting !== null} onClick={() => createBatch(true)}>
          {submitting === 'submit' ? 'Creating...' : 'Create Batch & Submit for Testing'}
        </Button>
        <Button type="button" size="lg" variant="outline" disabled={submitting !== null} onClick={() => createBatch(false)}>
          {submitting === 'draft' ? 'Saving...' : 'Save as Draft'}
        </Button>
        <button
          type="button"
          onClick={() => navigate('/farmer/batches/new/step-2')}
          className="text-center text-sm font-medium text-primary-700 hover:underline"
        >
          Back
        </button>
      </div>
    </div>
  )
}
