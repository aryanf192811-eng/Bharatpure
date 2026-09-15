import { useQuery } from '@tanstack/react-query'
import { CreditCard, Network, Sprout, TrendingUp } from 'lucide-react'
import { useState } from 'react'

import { dpiApi } from '@/api/dpi.api'
import { Button } from '@/components/ui/button'

export default function DpiStatus() {
  const [showJson, setShowJson] = useState(false)
  const agristack = useQuery({ queryKey: ['dpi', 'agristack'], queryFn: () => dpiApi.agristackFarmer('AGS-2026-MH-00041'), enabled: false });
  const enam = useQuery({ queryKey: ['dpi', 'enam'], queryFn: () => dpiApi.enamPrices({ crop_type: 'TURMERIC', days: 7 }), enabled: false });
  const ondc = useQuery({ queryKey: ['dpi', 'ondc'], queryFn: dpiApi.ondcListings, enabled: false });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-earth-900">Government DPI Integration Status</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-md bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Sprout className="size-5 text-primary-700" />
            <p className="font-semibold text-earth-900">AgriStack Farmer ID</p>
          </div>
          <span className="w-fit rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">🟡 Sandbox / Mock</span>
          <p className="text-xs text-earth-500">10.31 crore Farmer IDs created nationally. Production requires authorized state API access and farmer consent.</p>
          <Button size="sm" variant="outline" className="mt-1 w-fit" onClick={() => agristack.refetch()}>Test API</Button>
        </div>

        <div className="flex flex-col gap-2 rounded-md bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary-700" />
            <p className="font-semibold text-earth-900">eNAM Price Feed</p>
          </div>
          <span className="w-fit rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">🟡 Mock Feed (static JSON)</span>
          <p className="text-xs text-earth-500">Production requires eNAM API integration.</p>
          <Button size="sm" variant="outline" className="mt-1 w-fit" onClick={() => enam.refetch()}>Test API</Button>
        </div>

        <div className="flex flex-col gap-2 rounded-md bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Network className="size-5 text-primary-700" />
            <p className="font-semibold text-earth-900">ONDC SNP Adapter</p>
          </div>
          <span className="w-fit rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">🟡 Sandbox</span>
          <p className="text-xs text-earth-500">BharatPure operates as ONDC Seller Network Participant. Production requires ONDC participant onboarding.</p>
          <Button size="sm" variant="outline" className="mt-1 w-fit" onClick={() => ondc.refetch()}>Test API</Button>
        </div>

        <div className="flex flex-col gap-2 rounded-md bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-success" />
            <p className="font-semibold text-earth-900">UPI Payments</p>
          </div>
          <span className="w-fit rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">✅ Simulated in prototype</span>
          <p className="text-xs text-earth-500">Payment references stored. Production requires payment gateway integration.</p>
        </div>
      </div>

      <div className="rounded-md border border-warning/30 bg-warning-bg p-4 text-sm text-earth-900">
        All integrations shown in sandbox/mock mode. Production deployment requires formal API authorization from respective government bodies. Integration boundaries and data contracts are fully designed.
      </div>

      {ondc.data && (
        <div className="rounded-md bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-earth-900">ONDC Catalog Preview</p>
            <button type="button" onClick={() => setShowJson((v) => !v)} className="text-xs text-primary-700 hover:underline">
              {showJson ? 'Hide JSON' : 'Show JSON'}
            </button>
          </div>
          {showJson && (
            <pre className="max-h-64 overflow-auto rounded bg-earth-900 p-3 text-xs text-earth-50">
              {JSON.stringify(ondc.data.data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {(agristack.data || enam.data) && (
        <div className="rounded-md bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-earth-900">Last Test Result</p>
          <pre className="max-h-64 overflow-auto rounded bg-earth-900 p-3 text-xs text-earth-50">
            {JSON.stringify(agristack.data?.data ?? enam.data?.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
