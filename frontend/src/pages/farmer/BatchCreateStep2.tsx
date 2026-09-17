import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useBatchDraftStore } from '@/stores/batchDraft.store'

export default function BatchCreateStep2() {
  const navigate = useNavigate()
  const draft = useBatchDraftStore()

  // Redirect-if-no-draft has to live in an effect, not the render body -- calling navigate()
  // (a setState on the router) while this component is still rendering is exactly the
  // "Cannot update a component while rendering a different component" React warning, and it
  // races the *next* screen's own render against this one's.
  useEffect(() => {
    if (!draft.clusterId) {
      navigate('/farmer/batches/new/step-1', { replace: true })
    }
  }, [draft.clusterId, navigate])

  if (!draft.clusterId) {
    return null
  }

  return (
    <div className="mx-auto flex max-w-[480px] flex-col p-4 pb-24">
      <p className="mb-1 text-xs font-semibold text-primary-800">Step 2 of 3</p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-earth-900">Quality assessment</h1>

      <div className="mt-3 rounded border-l-4 border-success bg-success-bg p-3 text-sm text-earth-900">
        Your batch will be tested by our team. Fill in what you know now; our field agent will verify on pickup.
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <div>
          <Label>Your estimated purity: {draft.estimatedPurity}</Label>
          <Slider
            className="mt-3"
            min={0}
            max={100}
            step={1}
            value={[draft.estimatedPurity]}
            onValueChange={([v]) => draft.set({ estimatedPurity: v })}
          />
        </div>

        <div>
          <Label>Storage Method</Label>
          <Select value={draft.storageMethod} onValueChange={(v) => draft.set({ storageMethod: v })}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue placeholder="Select storage method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Jute bag">Jute bag</SelectItem>
              <SelectItem value="Polypropylene bag">Polypropylene bag</SelectItem>
              <SelectItem value="Cold storage">Cold storage</SelectItem>
              <SelectItem value="Field stacked">Field stacked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Any treatment applied?</Label>
          <RadioGroup
            className="mt-2 flex gap-4"
            value={draft.treatmentApplied ? 'yes' : 'no'}
            onValueChange={(v) => draft.set({ treatmentApplied: v === 'yes' })}
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="yes" /> Yes
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="no" /> No
            </label>
          </RadioGroup>
          {draft.treatmentApplied && (
            <Input
              placeholder="Describe treatment"
              value={draft.treatmentDescription}
              onChange={(e) => draft.set({ treatmentDescription: e.target.value })}
              className="mt-2"
            />
          )}
        </div>

        <div>
          <Label>Pesticide use in last season</Label>
          <RadioGroup
            className="mt-2 flex flex-col gap-2"
            value={draft.pesticideUse}
            onValueChange={(v) => draft.set({ pesticideUse: v as typeof draft.pesticideUse })}
          >
            {(['None', 'Standard', 'Organic certified'] as const).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={option} /> {option}
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <Button type="button" size="lg" onClick={() => navigate('/farmer/batches/new/step-3')}>
          Continue
        </Button>
        <button
          type="button"
          onClick={() => navigate('/farmer/batches/new/step-1')}
          className="text-center text-sm font-medium text-primary-700 hover:underline"
        >
          Back
        </button>
      </div>
    </div>
  )
}
