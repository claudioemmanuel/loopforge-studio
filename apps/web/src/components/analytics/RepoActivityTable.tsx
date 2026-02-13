import type { RepoActivitySummary } from '@loopforge/shared'

interface RepoActivityTableProps {
  data: RepoActivitySummary[]
}

export function RepoActivityTable({ data }: RepoActivityTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
        No repository activity yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Repository</th>
            <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Tasks</th>
            <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground">Tokens Used</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.repositoryId} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-5 py-3 font-medium">{row.fullName}</td>
              <td className="px-5 py-3 text-right tabular-nums">{row.taskCount}</td>
              <td className="px-5 py-3 text-right tabular-nums">{row.tokensUsed.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
