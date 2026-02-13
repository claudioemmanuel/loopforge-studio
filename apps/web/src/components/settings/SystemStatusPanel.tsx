import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

interface ServiceStatus {
  status: 'ok' | 'idle' | 'error'
  latencyMs?: number
  error?: string
  queue?: {
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }
}

interface StatusResponse {
  api: ServiceStatus
  database: ServiceStatus
  redis: ServiceStatus
  worker: ServiceStatus
}

function StatusDot({ status }: { status: ServiceStatus['status'] }) {
  const color =
    status === 'ok' ? 'bg-green-500' : status === 'idle' ? 'bg-yellow-400' : 'bg-red-500'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
}

function StatusLabel({ status }: { status: ServiceStatus['status'] }) {
  const text = status === 'ok' ? 'OK' : status === 'idle' ? 'Idle' : 'Error'
  const color =
    status === 'ok'
      ? 'text-green-600 dark:text-green-400'
      : status === 'idle'
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400'
  return <span className={`text-sm font-medium ${color}`}>{text}</span>
}

export function SystemStatusPanel() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/status') // nginx proxies /api/* → API server /
      const json = await res.json()
      setData(json)
      setLastChecked(new Date())
      setSecondsAgo(0)
    } catch {
      // silently fail — next interval will retry
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
    const poll = setInterval(() => void fetchStatus(), 15_000)
    return () => clearInterval(poll)
  }, [fetchStatus])

  useEffect(() => {
    if (!lastChecked) return
    const tick = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastChecked.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastChecked])

  const services: Array<{ key: keyof StatusResponse; label: string }> = [
    { key: 'api', label: 'API' },
    { key: 'database', label: 'Database (PostgreSQL)' },
    { key: 'redis', label: 'Redis' },
    { key: 'worker', label: 'Execution Worker' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lastChecked ? `Last checked: ${secondsAgo}s ago` : 'Checking…'}
        </p>
        <button
          onClick={() => void fetchStatus()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {services.map(({ key, label }) => {
        const svc = data?.[key]
        return (
          <div key={key} className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              {svc ? <StatusDot status={svc.status} /> : <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />}
              <span className="font-medium">{label}</span>
              {svc && <StatusLabel status={svc.status} />}
            </div>

            {svc?.latencyMs !== undefined && svc.latencyMs >= 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{svc.latencyMs}ms</p>
            )}

            {svc?.error && (
              <p className="mt-1 text-xs text-red-500">{svc.error}</p>
            )}

            {svc?.queue && (
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                {(['waiting', 'active', 'completed', 'failed'] as const).map((k) => (
                  <div key={k} className="rounded bg-muted px-2 py-1">
                    <div className="font-mono font-medium">{svc.queue![k]}</div>
                    <div className="text-muted-foreground capitalize">{k}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
