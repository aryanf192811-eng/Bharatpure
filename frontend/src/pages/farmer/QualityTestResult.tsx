import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { batchApi } from '@/api/batch.api'
import { qualityApi } from '@/api/quality.api'
import { Skeleton } from '@/components/ui/skeleton'

export default function QualityTestResult() {
  const { batchId } = useParams<{ batchId: string }>()
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

  if (isLoading || !batchRes) {
    return (
      <div className="mx-auto max-w-[480px] p-4">
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const batch = batchRes.data
  const latestTest = testsRes?.data[0]
  const passed = latestTest?.result === 'PASS'

  return (
    <div className="mx-auto flex max-w-[480px] flex-col gap-5 p-4">
      <div className={`flex flex-col items-center rounded-md p-6 text-center shadow-sm ${passed ? 'bg-success-bg' : 'bg-danger-bg'}`}>
        {passed ? <CheckCircle2 className="size-10 text-success" /> : <XCircle className="size-10 text-danger" />}
        <p className="mt-2 font-display text-xl font-bold text-earth-900">{passed ? 'Batch PASSED' : 'Batch REJECTED'}</p>
        <p className="mt-1 font-mono text-xs text-earth-700">{batch.batch_code}</p>
      </div>

      {latestTest && (
        <div className="rounded-md bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-earth-900">Purity Score</span>
            <span className="font-display text-2xl font-bold text-primary-800">{latestTest.purity_score ?? '—'}</span>
          </div>
          {latestTest.test_parameters && Object.keys(latestTest.test_parameters).length > 0 && (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {Object.entries(latestTest.test_parameters).map(([key, value]) => (
                  <tr key={key} className="border-t border-earth-100">
                    <td className="py-1.5 text-earth-700">{key.replace(/_/g, ' ')}</td>
                    <td className="py-1.5 text-right font-medium text-earth-900">{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {passed ? (
        <Link
          to="/farmer/batches/new/step-1"
          className="flex items-center justify-center rounded-md bg-primary-800 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          Your batch is approved — list it on the marketplace from Batch Detail
        </Link>
      ) : (
        <div className="rounded-md border border-danger/30 bg-danger-bg p-4">
          <p className="text-sm font-semibold text-danger">Rejection guidance</p>
          <p className="mt-1 text-sm text-earth-700">
            You can request an independent B-sample referee test from the batch detail page.
          </p>
        </div>
      )}

      <Link to={`/farmer/batches/${batchId}`} className="text-center text-sm text-earth-500 hover:text-earth-700">
        View full batch detail &rarr;
      </Link>
    </div>
  )
}
