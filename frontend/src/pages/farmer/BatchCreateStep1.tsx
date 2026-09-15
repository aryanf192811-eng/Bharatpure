import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { clusterApi } from '@/api/cluster.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useBatchDraftStore } from '@/stores/batchDraft.store'

function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Crop', 'Quality', 'Pricing']
  return (
    <div className="mb-4 flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i + 1 === step ? 'text-primary-800' : 'text-earth-400'}`}>
            <span className={`size-2 rounded-full ${i + 1 <= step ? 'bg-gold-600' : 'bg-earth-300'}`} />
            <span className="text-xs font-semibold">{i + 1}. {label}</span>
          </div>
          {i < steps.length - 1 && <span className="h-px w-4 bg-earth-200" />}
        </div>
      ))}
    </div>
  )
}

export default function BatchCreateStep1() {
  const navigate = useNavigate()
  const draft = useBatchDraftStore()
  const { data: clusters } = useQuery({ queryKey: ['clusters'], queryFn: () => clusterApi.list() })

  const selectedCluster = clusters?.data.find((c) => c.id === draft.clusterId)
  const canContinue = draft.clusterId && draft.harvestDate && Number(draft.totalQuantityKg) > 0

  return (
    <div className="mx-auto flex max-w-[480px] flex-col p-4 pb-24">
      <StepProgress step={1} />
      <h1 className="font-display text-2xl font-bold tracking-tight text-earth-900">Tell us about your harvest</h1>

      <div className="mt-6 flex flex-col gap-4">
        <div>
          <Label>Cluster</Label>
          <Select
            value={draft.clusterId}
            onValueChange={(value) => {
              const cluster = clusters?.data.find((c) => c.id === value)
              draft.set({ clusterId: value, cropType: cluster?.crop_type ?? '' })
            }}
          >
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue placeholder="Select a cluster" />
            </SelectTrigger>
            <SelectContent>
              {clusters?.data.map((cluster) => (
                <SelectItem key={cluster.id} value={cluster.id}>
                  {cluster.name} &mdash; {cluster.district}, {cluster.crop_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Crop Type</Label>
          <Input value={selectedCluster?.crop_type ?? ''} disabled className="mt-1.5 bg-earth-100" />
        </div>

        <div>
          <Label htmlFor="harvest_date">Harvest Date</Label>
          <Input
            id="harvest_date"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={draft.harvestDate}
            onChange={(e) => draft.set({ harvestDate: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="quantity">Total Quantity (kg)</Label>
          <Input
            id="quantity"
            type="number"
            step={0.5}
            min={0.5}
            value={draft.totalQuantityKg}
            onChange={(e) => draft.set({ totalQuantityKg: e.target.value })}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g. late-monsoon harvest, slightly darker color"
            value={draft.notes}
            onChange={(e) => draft.set({ notes: e.target.value })}
            className="mt-1.5"
          />
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={!canContinue}
        onClick={() => navigate('/farmer/batches/new/step-2')}
        className="mt-8"
      >
        Continue
      </Button>
    </div>
  )
}
