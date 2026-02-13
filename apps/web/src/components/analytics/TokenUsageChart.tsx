import type { ProviderUsageSummary } from '@loopforge/shared'

interface TokenUsageChartProps {
  data: ProviderUsageSummary[]
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
        No token usage data yet.
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.tokensUsed), 1)

  return (
    <div className="rounded-xl border bg-card p-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Provider</th>
            <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Model</th>
            <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Tokens</th>
            <th className="w-48 pb-2" />
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="py-2.5 font-medium">{row.provider}</td>
              <td className="py-2.5 font-mono text-xs text-muted-foreground">{row.model}</td>
              <td className="py-2.5 text-right tabular-nums">{row.tokensUsed.toLocaleString()}</td>
              <td className="py-2.5 pl-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(row.tokensUsed / max) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
