import { useEffect, useState } from 'react'
import { apiClient } from '../services/api.client'
import type { AnalyticsSummaryResponse } from '@loopforge/shared'
import { MetricCard } from '../components/analytics/MetricCard'
import { TokenUsageChart } from '../components/analytics/TokenUsageChart'
import { RepoActivityTable } from '../components/analytics/RepoActivityTable'

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiClient
      .get<AnalyticsSummaryResponse>('/analytics')
      .then(setData)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading analytics…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Failed to load analytics.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total Tasks" value={data.totalTasks} />
        <MetricCard label="Completed" value={data.completedTasks} />
        <MetricCard label="Success Rate" value={`${Math.round(data.successRate * 100)}%`} />
        <MetricCard
          label="Tokens Used"
          value={data.totalTokensUsed.toLocaleString()}
        />
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Token Usage by Provider</h2>
        <TokenUsageChart data={data.byProvider} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Repository Activity</h2>
        <RepoActivityTable data={data.byRepository} />
      </div>
    </div>
  )
}
