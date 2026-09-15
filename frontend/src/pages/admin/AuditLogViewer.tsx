import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Fragment, useState } from 'react'

import { adminApi } from '@/api/admin.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AuditLogViewer() {
  const [entityType, setEntityType] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['admin', 'audit-logs', entityType],
    queryFn: () => adminApi.auditLogs({ entity_type: entityType || undefined, limit: 50 }),
  })

  const exportCsv = () => {
    if (!data) return
    const header = 'timestamp,actor_role,action,entity_type,entity_id\n'
    const rows = data.data.map((a) => `${a.created_at},${a.actor_role},${a.action},${a.entity_type},${a.entity_id}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audit-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-earth-900">Audit Log</h1>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <Input placeholder="Filter by entity type (e.g. batch, order)" value={entityType} onChange={(e) => setEntityType(e.target.value)} className="max-w-sm" />

      <div className="overflow-x-auto rounded-md bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-earth-100 text-left text-xs uppercase text-earth-500">
              <th className="p-3">Timestamp</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((log) => (
              <Fragment key={log.id}>
                <tr
                  className="cursor-pointer border-b border-earth-50 hover:bg-earth-50"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <td className="p-3">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                  <td className="p-3">{log.actor_role}</td>
                  <td className="p-3 font-mono text-xs">{log.action}</td>
                  <td className="p-3">
                    {log.entity_type} <span className="font-mono text-xs text-earth-500">{log.entity_id?.slice(0, 8)}</span>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr className="border-b border-earth-50 bg-earth-50">
                    <td colSpan={4} className="p-3">
                      <pre className="overflow-auto text-xs text-earth-700">
                        {JSON.stringify({ old_value: log.old_value, new_value: log.new_value }, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
