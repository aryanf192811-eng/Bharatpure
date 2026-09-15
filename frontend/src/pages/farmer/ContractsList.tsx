import { FileText } from 'lucide-react'

// Procurement contracts are explicitly out of scope for this build -- per BHARATPURE-CLAUDE.md's
// documented Phase 1 cut line: "Procurement contracts deferred to demo script only." No
// /api/contracts route group exists on the backend. This is an honest empty state, not a stub.
export default function ContractsList() {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-3 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-earth-100 text-earth-500">
        <FileText className="size-6" />
      </div>
      <h1 className="font-display text-xl font-bold text-earth-900">Procurement Contracts</h1>
      <p className="text-sm text-earth-700">
        Pre-sowing procurement agreements are covered in the BharatPure demo script and aren&apos;t part of this
        prototype build. The BharatPure team will contact you directly about the next procurement cycle.
      </p>
    </div>
  )
}
